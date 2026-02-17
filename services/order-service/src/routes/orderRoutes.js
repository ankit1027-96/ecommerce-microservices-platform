const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController.js");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const {
  validateCreateOrder,
  validateCancelOrder,
  validateReturnOrder,
  validateOrderId,
  validateOrderQuery,
  validateConfirmPayment,
} = require("../middleware/validation");
const orderService = require("../services/orderService.js");

// All routes require authentication
router.use(requireAuth);

// User routes
router.post("/", validateCreateOrder, orderController.createOrder);
router.get("/", validateOrderQuery, orderController.getOrders);
router.get("/stats", orderController.getOrderStats);
router.get("/:orderId", validateOrderId, orderController.getOrderById);
router.get("/:orderId/track", validateOrderId, orderController.trackOrder);
router.post(
  "/:orderId/cancel",
  validateOrderId,
  validateCancelOrder,
  orderService.cancelOrder,
);
router.post(
  "/:orderId/return",
  validateOrderId,
  validateReturnOrder,
  orderController.initiateReturn,
);

// Webhook routes (for payment service)
router.post(
  "/webhook/payment-confirmation",
  validateConfirmPayment,
  orderController.confirmPayment,
);

module.exports = router;

