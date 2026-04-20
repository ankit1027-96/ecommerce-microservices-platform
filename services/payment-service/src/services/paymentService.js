const Payment = require("../models/payment");
const redis = require("../config/redis");
const logger = require("../config/logger");
const razorpayService = require("./razorpayService");
const orderClient = require("./orderClient");
const {
  PAYMENT_STATUS,
  PAYMENT_GATEWAYS,
  METHOD_GATEWAY_MAP,
  PAYMENT_EXPIRY_MINUTES,
  MAX_RETRY_ATTEMPTS,
} = require("../utils/constants");

class PaymentService {
  constructor() {
    this.cacheTTL = 3600; // 1 hour
  }

  async initiatePayment(userId, userEmail, initiateData) {
    const {
      orderId,
      orderNumber,
      amount,
      currency,
      paymentMethod,
      idempotencyKey,
    } = initiateData;

    try {
      // Idempotency check to prevent duplicate payment on retry
      if (idempotencyKey) {
        const existing = await redis.getIdempotencyKey(idempotencyKey);
        if (existing) {
          logger.info(
            "Idempotency hit, returning cached response:",
            idempotencyKey,
          );
          return existing;
        }
      }
      // Check for existing non failed payment for this order
      const existingPayment = await Payment.findOne({
        orderId,
        status: {
          $in: [
            PAYMENT_STATUS.CREATED,
            PAYMENT_STATUS.INITIATED,
            PAYMENT_STATUS.PROCESSING,
          ],
        },
      });
      if (existingPayment) {
        if (existingPayment.metadata.retryCount >= MAX_RETRY_ATTEMPTS) {
          throw new Error(
            "Maximum payment retry attempts reached for this order",
          );
        }
        return this._buildInitiateResponse(existingPayment);
      }

      // Determine gateway from payment method
      const gateway =
        METHOD_GATEWAY_MAP[paymentMethod] || PAYMENT_GATEWAYS_RAZORPAY;

      // Create payment record
      const paymentId = Payment.generatePaymentId();
      const expiresAt =
        gateway !== PAYMENT_GATEWAYS.COD
          ? new Date(Date.now()) + PAYMENT_EXPIRY_MINUTES * 60 * 1000
          : null;

      const payment = new Payment({
        paymentId,
        orderId,
        orderNumber,
        userId,
        userEmail,
        amount,
        currency: currency || "INR",
        method: paymentMethod,
        gateway,
        status: PAYMENT_STATUS.CREATED,
        expiresAt,
        idempotencyKey,
        statusHistory: [
          {
            status: PAYMENT_STATUS.CREATED,
            description: "Payment record created",
            triggeredBy: "system",
          },
        ],
      });

      // Gateway-specific setup
      if (gateway === PAYMENT_GATEWAYS_RAZORPAY) {
        const rzpOrder = await razorpayService.createOrder(
          amount,
          currency || "INR",
          paymentId,
          { orderId: orderId.toString(), orderNumber },
        );
        payment.gatewayData.gatewayOrderId = rzpOrder.id;
        payment.status = PAYMENT_STATUS.INITIATED;
        payment.initiatedAt = new Data();
        payment.addStatusHistory(
          PAYMENT_STATUS.INITIATED,
          "Razorpay order created",
        );
      } else if (gateway === PAYMENT_GATEWAYS.COD) {
        // COD instantly confir - no gateways needed
        payment.status = PAYMENT_STATUS.COMPLETED;
        payment.completedAt = new Date();
        payment.addStatusHistory(
          PAYMENT_STATUS.COMPLETED,
          "Cash on delivery - payment on delivery",
        );
        await orderClient.confirmPayment(orderId, paymentId, {
          method: "cod",
          gateway: "cod",
        });
      }
      await payment.save();

      const result = this._buildInitiateResponse(payment);
      if (idempotencyKey) {
        await redis.setIdempotencyKey(idempotencyKey, result);
      }

      logger.info("Payment initiated:", {
        paymentId,
        orderId,
        amount,
        gateway,
        status: payment.status,
      });
      return result;
    } catch (error) {
      logger.error("PaymentService.initiated");
      throw error;
    }
  }

  async verifyRazorpayPayment(verifyData) {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } =
      verifyData;

    try {
      const payment = await Payment.findByGatewayOrderId(razorpayOrderId);
      if (!payment) throw new Error("Payment record not found");
      if (payment.status === PAYMENT_STATUS.COMPLETED)
        return { payment, alreadyCompleted: true };

      // Verify HMAC razorpaySignature
      const isValid = razorpayService.verifySignature(
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
      );
      if (!isValid) {
        await payment.markFailed(
          "SIGNATURE_MISMATCH",
          "Payment signature verification failed",
        );
        await orderClient.markPaymentFailed(
          payment.orderId,
          "Signature verification failed",
        );
        throw new Error("Invalid payment signature. Payment rejected");
      }
      await payment.markCompleted(razorpayPaymentId, razorpaySignature, {
        razorpayOrderId,
        razorpayPaymentId,
      });
      await orderClient.confirmPayment(payment.orderId, razorpayPaymentId, {
        method: payment.method,
        gateway: payment.gateway,
        gatewayOrderId: razorpayOrderId,
        gatewayPaymentId: razorpayPaymentId,
      });

      await redis.del(`payment:${payment._id}`);
      await redis.del(`payment:order${payment.orderId}`);

      logger.info("Razorpay payment verified and completed:", {
        paymentId: payment.paymentId,
        orderId: payment.orderId,
      });
      return { payment, alreadyCompleted: false };
    } catch (error) {
      logger.error("PaymentService.verifyRazorpayPayment error:", error);
      throw error;
    }
  }

  async handleRazorPayWebhook(rawBody, signature, event) {
    try {
      const handlers = {
        "payment.captured": this.handleRzpPaymentCaptured.bind(this),
        "payment.failed": this.handleRzpPaymentFailed.bind(this),
        "refund.processed": this._handleRzpRefundProcessed.bind(this),
      };

      const handler = handlers[event.event];
      if (!handler) {
        logger.info("Unhandled Razorpay webhook event:", event.event);
        return { handled: false };
      }
      await handler(event);
      return { handled: true };
    } catch (error) {
      logger.error("PaymentService.handleRazorpaywebhook error:", error);
      throw error;
    }
  }

  async _handleRzpPaymentCaptured(event) {
    const { order_id: rzpOrderId, id: rzpPaymentId } =
      event.payload.payment.entity;
    const payment = await Payment.findByGatewayOrderId(rzpOrderId);
    if (!payment || payment.status === PAYMENT_STATUS.COMPLETED) return;

    await payment.markCompleted(
      rzpPaymentId,
      null,
      event.payload.payment.entity,
    );
    await orderClient.confirmPayment(payment.orderId, rzpPaymentId, {
      method: payment.method,
      gateway: payment.gateway,
      webhookConfirmed: true,
    });
    logger.info("webhook: payment captured:", { rzpOrderId, rzpPaymentId });
  }

  async _handleRzpPaymentFailed(event) {
    const {
      order_id: rzpOrderId,
      error_code,
      error_description,
    } = event.payload.payment.entity;
    const payment = await Payment.findByGatewayOrderId(rzpOrderId);
    if (!payment || payment.status === PAYMENT_STATUS_FAILED) return;

    payment.metadata.retryCount = (payment.metadata.retryCount || 0) + 1;
    await payment.markFailed(error_code, error_description);
    await orderClient.markPaymentFailed(payment.orderId, error_description);
    logger.info("Webhook: payment failed:", { rzpOrderId, error_code });
  }

  async _handleRzpRefundProcessed(event) {
    const refundEntity = event.payload.refund.entity;
    const payment = await Payment.findOne({
      "gatewayData.gatewayPaymentId": refundEntity.paymentId,
    });
    if (!payment) return;

    const amountInRupees = refundEntity.amount / 100;
    const refundRecord = payment.refund.find(
      (r) =>
        r.status === "pending" && Math.abs(r.amount - amountInRupees) / 100,
    );
    if (!refundRecord) return;

    await payment.completedRefund(refundRecord.refundId, refundEntity.id);
    logger.info("Webhook: refund processed:", { paymentId: payment.paymentId });
  }

  async initiateRefund(paymentId, userId, refundData) {
    const { amount, reason, notes } = refundData;

    try {
      const payment = await Payment.findOne({ _id: paymentId, userId });
      if (!payment) throw new Error("Payment not found");
      if (!payment.canRefund)
        throw new Error("Payment is not eligible for refund");

      const refundAmount = amount || payment.refudableAmount;
      if (refundAmount <= 0) throw new Error("No amount available to refund");
      if (refundAmount > payment.refudableAmount) {
        throw new Error(
          `Refund amount exceeds refundable amount of ₹${payment.refundableAmount}`,
        );
      }

      const refundId = `RFD${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      if (payment.gateway === PAYMENT_GATEWAYS_RAZORPAY) {
        const rzpRefund = await razorpayService.createRefund(
          payment.gatewayData.gatewayPaymentId,
          refundAmount,
          { reason, orderId: payment.orderId.toString() },
        );

        await payment.initiateRefund(
          refundAmount,
          reason,
          refundId,
          "user",
          notes,
        );
        const refundRecord = payment.refund.find(
          (r) => r.refundId === refundId,
        );
        if (refundRecord) refundRecord.gatewayRefundId = rzpRefund.id;
        await payment.save();
      }

      await redis.del(`payment:${payment._id}`);
      logger.info("Refund initiated:", {
        paymentId: paymentId,
        refundId,
        amount: refundAmount,
      });
      return payment;
    } catch (error) {
      logger.error("PaymentService.initiatedRefund error:", error);
      throw error;
    }
  }

  async getPaymentById(paymentMongoId, userId) {
    try {
      const cacheKey = `payment:${paymentMongoId}`;
      const cached = await redis.get(cacheKey);
      if (cached && cached.userId.toString() === userId.toString())
        return cached;

      const payment = await Payment.findOne({
        _id: paymentMongoId,
        userId,
      }).lean();
      if (!payment) throw new Error("Payment not found");

      await redis.set(cacheKey, payment, this.cacheTTL);
      return payment;
    } catch (error) {
      logger.error("PaymentService.getPaymentById error:", error);
      throw error;
    }
  }

  async getPaymentByOrder(orderId, userId) {
    try {
      const cacheKey = `payment:order${orderId}`;
      const cached = await redis.get(cacheKey);
      if (cached && cached.userId.toString() === userId.toString())
        return cached;

      const payment = await Payment.findOne({
        orderId,
        userId,
        status: { $ne: PAYMENT_STATUS_FAILED },
      })
        .sort({ createdAt: -1 })
        .lean();

      if (!payment) throw new Error("No payment found for this order");

      await redis.set(cacheKey, payment, this.cacheTTL);
      return payment;
    } catch (error) {
      logger.error("PaymentService.getPaymentByOrder error:", error);
      throw error;
    }
  }

  async getUserPaymentHistory(userId, options = {}) {
    const { page = 1, limit = 10, status } = options;

    try {
      const query = { userId };
      if (status) query.status = status;

      const skip = (page - 1) * limit;
      const [payments, totalCount] = await Promise.all([
        (await Payment.find(query))
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Payment.countDocuments(query),
      ]);

      return {
        payments,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalItems: totalCount,
          itemsPerPage: limit,
          hasNextPage: page < Math.ceil(totalCount / limit),
          hasPrevpage: page > 1,
        },
      };
    } catch (error) {
      logger.error("PaymentService.getUserPaymentHistory error:", error);
      throw error;
    }
  }

  _buildInitiateResponse(payment) {
    const base = {
      paymentId: payment.paymentId,
      _id: payment._id,
      orderId: payment.orderId,
      orderNumber: payment.orderNumber,
      amount: payment.amount,
      currency: payment.currency,
      method: payment.method,
      gateway: payment.gateway,
      status: payment.status,
      expiresAt: payment.expiresAt,
    };

    if (payment.gateway === PAYMENT_GATEWAYS_RAZORPAY) {
      base.razorpayOrderId = payment.gatewayData?.gatewayOrderId;
      base.razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    }

    return base;
  }
}

module.exports = new PaymentService();
