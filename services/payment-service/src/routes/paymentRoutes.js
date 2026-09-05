const express = require("express");
const router = express.Router();
const {
  initiatePayment,
  verifyRazorpayPayment,
  razorpayWebhook,
  initiateRefund,
  getPaymentById,
  getPaymentByOrder,
  getPaymentHistory,
  healthCheck,
} = require("../controllers/paymentController.js");
const { requireAuth } = require("../middleware/auth");
const {
  schemas,
  validate,
  validateQuery,
} = require("../middleware/validation");

// Public
router.get("/health", healthCheck);

// Webhook (rawBody set in app.js)
router.post("/webhook/razorpay", razorpayWebhook);

// Authenticated
router.post(
  "/initiate",
  requireAuth,
  validate(schemas.initiatePayment),
  initiatePayment,
);
router.post(
  "/verify/razorpay",
  requireAuth,
  validate(schemas.verifyRazorpay),
  verifyRazorpayPayment,
);
router.get("/", requireAuth, validateQuery(schemas.getPaymentHistory), getPaymentHistory);
router.get("/order/:orderId", requireAuth, getPaymentByOrder);
router.get("/:id", requireAuth, getPaymentById);
router.post(
  "/:id/refund",
  requireAuth,
  validate(schemas.initiateRefund),
  initiateRefund,
);

module.exports = router;