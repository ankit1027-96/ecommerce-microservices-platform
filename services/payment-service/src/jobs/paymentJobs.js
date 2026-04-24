const cron = require("node-cron");
const Payment = require("../models/payment");
const redis = require("../config/redis");
const logger = require("../config/logger");
const { PAYMENT_STATUS } = require("../utils/constants");

// Expire payments that passed their expiresAt timestamp - runs every 5 minutes

const expireStalePayments = async () => {
  try {
    const stalePayments = await Payment.find({
      status: {
        $in: [
          PAYMENT_STATUS.CREATED,
          PAYMENT_STATUS.INITIATED,
          PAYMENT_STATUS.PROCESSING,
        ],
        expiresAt: { $lt: new Date() },
      },
    });
    if (stalePayments.length === 0) return;
    logger.info(
      `Payment expiry job: found ${stalePayments.length} stale payment(s)`,
    );

    for (const payment of stalePayments) {
      payment.addStatusHistory(
        PAYMENT_STATUS.FAILED,
        "Payment expired - user did not complete checkout within the allowed window",
        "system",
      );
      payment.failureCode = "PAYMENT_EXPIRED";
      payment.failureMessage = "Payment session expired";
      payment.failedAt = new Date();
      await payment.save();

      await redis.del(`payment:${payment._id}`);
      await redis.del(`payment:order:${payment.orderId}`);

      logger.info("Payment expired:", {
        paymentId: payment.payment,
        orderId: payment.orderId,
      });
    }
  } catch (error) {
    logger.error("Payment expiry job error:", error);
  }
};

const startPaymentExpiryJob = () => {
  cron.schedule("*/5 * * * *", expireStalePayments);
  logger.info("Payment expiry job started (runs every 5 minutes)");
};

module.exports = { startPaymentExpiryJob, expireStalePayments };
