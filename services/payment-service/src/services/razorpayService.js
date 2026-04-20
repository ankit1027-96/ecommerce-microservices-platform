const crypto = require("crypto");
const logger = require("../config/logger");

class RazorpayService {
  constructor() {
    this._instance = null;
  }

  _getInstance() {
    if (!this._instance) {
      if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        throw new Error("Razorpay credentials not configured in environment");
      }
      const Razorpay = require("razorpay");
      this._instance = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      });

      logger.info("Razorpay gateway initialized");
    }
    return this._instance;
  }

  async createOrder(amount, currency, receipt, notes = {}) {
    try {
      const razorpay = this._getInstance();
      const amountInPaise = Math.round(amount * 100); // Razorpay needs amount in paise

      const order = await razorpay.orders.create({
        amount: amountInPaise,
        currency: currency || "INR",
        receipt,
        notes,
        payment_capture: 1, // Auto-capture
      });
      logger.info("Razorpay order created:", {
        razorpayOrderId: order.id,
        amount,
      });
      return order;
    } catch (error) {
      logger.error("Razorpay createOrder error:", error);
      throw new Error(`Gateway error: ${error.description || error.message}`);
    }
  }
  verifySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature) {
    try {
      const body = `${razorpayOrderId}|${razorpayPaymentId}`;
      const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(body)
        .digest("hex");

      const isValid = expectedSignature === razorpaySignature;
      logger.info("Razorpay signature verfication error:", error);
      return isValid;
    } catch (error) {
      logger.error("Razorpay signature verficaion error:", error);
      return false;
    }
  }
  verifyWebhookSignature(rawBody, signature) {
    try {
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
      if (!webhookSecret) {
        logger.warn(
          "RAZORPAY_WEBHOOK_SECRET not set; skipping webhook verification",
        );
        return true;
      }
      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(rawBody)
        .digest("hex");
      return expectedSignature === signature;
    } catch (error) {
      logger.error("Razorpay webhook verification error:", error);
      return false;
    }
  }

  async fetchPayment(razorpayPaymentId) {
    try {
      const razorpay = this._getInstance();
      return await razorpay.payments.fetch(razorpayPaymentId);
    } catch (error) {
      logger.error("Razorpay fetchPayment error:", error);
      throw new Error(`Gateway error: ${error.description || error.message}`);
    }
  }

  async createRefund(razorpayPaymentId, amount, notes = {}) {
    try {
      const razorpay = this._getInstance();
      const amountInPaise = Math.round(amount * 100);

      const refund = await razorpay.payments.refund(razorpayPaymentId, {
        amount: amountInPaise,
        notes,
        speed: "normal",
      });

      logger.info("Razorpay refund initiated:", {
        refundId: refund.id,
        amount,
      });
      return refund;
    } catch (error) {
      logger.error("Razorpay createRefund error:", error);
      throw new Error(
        `Refund gateway error: ${error.description || error.message}`,
      );
    }
  }
}

module.exports = new RazorpayService();
