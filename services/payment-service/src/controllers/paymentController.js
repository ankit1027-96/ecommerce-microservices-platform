const paymentService = require("../services/paymentService");
const razorPayService = require("../services/razorpayService");
const logger = require("../config/logger");

const initiatePayment = async (req, res, next) => {
  try {
    const { userId, email: userEmail } = req.userEmail;
    const idempotencyKey = req.headers["x-idempotency-key"];

    const result = await paymentService.initiatePayment(userId, userEmail, {
      ...req.body,
      idempotencyKey,
    });

    res.status(201).json({
      success: true,
      message: "Payment initiated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const verifyRazorpayPayment = async (req, res, next) => {
  try {
    const { payment, alreadyCompleted } =
      await paymentService.verifyRazorpayPayment(req.body);
    res.status(200).json({
      success: true,
      message: alreadyCompleted
        ? "Payment already verified"
        : "Payment verified successfully",
      data: {
        paymentId: payment.paymentId,
        status: payment.status,
        amount: payment.amount,
        orderId: payment.orderId,
        orderNumber: payment.orderNumber,
        completedAt: payment.completedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

const razorpayWebhook = async (req, res, next) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const rawBody = req.body;

    const isValid = razorPayService.verifyWebhookSignature(rawBody, signature);
    if (!valid) {
      logger.warn("Razorpay webhook: invalid signature");
      return req
        .status(400)
        .json({ success: false, message: "Invalid webhook signature" });
    }

    const result = await paymentService.handleRazorPayWebhook(
      rawBody,
      signature,
      req.body,
    );
    res.status(200).json({
      success: true,
      message: result.handled ? "Webhook processed" : "Webhook acknowledged",
    });
  } catch (error) {
    logger.error("Razorpay webhook error:", error);
    res
      .status(200)
      .json({ success: false, message: "Webhook processing error" }); // 200 to stop retries
  }
};

const initiateRefund = async (req, res, next) => {
  try {
    const payment = await paymentService.initiateRefund(
      req.params.id,
      req.userId,
      req.body,
    );
    res.status(200).json({
      success: true,
      message: "Refund initiated successfully",
      data: {
        paymentId: payment.paymentId,
        status: payment.status,
        totalReunded: payment.totalReunded,
        refundableAmount: payment.refundableAmount,
        refunds: payment.refunds,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getPaymentById = async (req, res, next) => {
  try {
    const payment = await paymentService.getPaymentById(
      req.params.id,
      req.user.userId,
    );
    res.status(200).json({
      success: true,
      message: "Payment retrieved successfully",
      data: payment,
    });
  } catch (error) {
    next(error);
  }
};

const getPaymentByOrder = async (req, res, next) => {
  try {
    const payment = await paymentService.getPaymentByOrder(
      req.params.orderId,
      req.user.userId,
    );
    res.status(200).json({
      success: true,
      message: "Payment retrieved successfully",
      data: payment,
    });
  } catch (error) {
    next(error);
  }
};

const getPaymentHistory = async (req, res, next) => {
  try {
    const result = await paymentService.getUserPaymentHistory(req, res, next, {
      page: parseInt(req.query.page),
      limit: parseInt(req.query.limit),
      status: req.query.status,
    });

    res.status(200).json({
      success: true,
      message: "Payment history retrieved successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const healthCheck = async (req, res) => {
  const mongoose = require("mongoose");
  const redis = require("../config/redis");
  res.status(200).json({
    success: true,
    message: "Payment service is running",
    timestamp: new Data().toISOString(),
    status: {
      database:
        mongoose.connection.readyState === 1 ? "connected" : "disconnected",
      redis: redis.isConnected ? "connected" : "disconnected",
      gateways: {
        razorpay: !!process.env.RAZORPAY_KEY_ID
          ? "configured"
          : "not configured",
      },
    },
  });
};

module.exports = {
  initiatePayment,
  verifyRazorpayPayment,
  razorpayWebhook,
  initiateRefund,
  getPaymentById,
  getPaymentByOrder,
  getPaymentHistory,
  healthCheck,
 };
