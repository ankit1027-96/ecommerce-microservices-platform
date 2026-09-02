const orderService = require("../services/orderService");
const logger = require("../config/logger");
const Order = require("../models/order");

class OrderController {
  async createOrder(req, res) {
    try {
      const userId = req.user.userId;
      const userEmail = req.user.email;
      const orderData = req.body;

      const order = await orderService.createOrder(
        userId,
        userEmail,
        orderData,
      );

      res.status(201).json({
        success: true,
        message: "Order created successfully",
        data: order,
      });
    } catch (error) {
      logger.error("Creat order controller error:", error);

      const statusCode =
        error.message.includes("empty") || error.message.includes("stock")
          ? 400
          : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message || "Failed to create order",
      });
    }
  }

  async getOrders(req, res) {
    try {
      const userId = req.user.userId;
      const options = {
        status: req.query.status,
        page: parseInt(req.query.limit) || 1,
        limit: parseInt(req.query.limit) || 10,
        sortBy: req.query.sortBy || "createdAt",
        sortOrder: req.query.sortOrder || "desc",
      };

      const result = await orderService.getUserOrders(userId, options);

      res.json({
        success: true,
        message: "Orders retrieved successfully",
        data: result,
      });
    } catch (error) {

      
      logger.error("Get orders controller error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to retrieve orders",
      });
    }
  }

  async getOrderById(req, res) {
    try {
      const { orderId } = req.params;
      const userId = req.user.userId;

      const order = await orderService.getOrder(orderId, userId);

      res.json({
        success: true,
        message: "Order retrieved successfully",
        data: order,
      });
    } catch (error) {
      logger.error("Get order by ID controller error:", error);
      const statusCode = error.message === "Order not found" ? 404 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message || "Failed to retrieve order",
      });
    }
  }

  async getOrderByNumber(req, res) {
    try {
      const { orderNumber } = req.params;
      const userId = req.user.userId;

      const order = await orderService.getOrderByNumber(orderNumber, userId);

      res.json({
        success: true,
        message: "Order retrieved successfully",
        data: order,
      });
    } catch (error) {
      logger.error("Get order by number controller error:", error);

      const statusCode = error.message === "Order not found" ? 404 : 500;

      res.status(statusCode).json({
        success: false,
        message: "Failed to retrieve order",
      });
    }
  }

  async cancelOrder(req, res) {
    try {
      const { orderId } = req.params;
      const userId = req.user.userId;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({
          success: false,
          message: "Cancellation reason is required",
        });
      }

      const order = await orderService.cancelOrder(
        orderId,
        userId,
        reason,
        "user",
      );

      res.json({
        success: true,
        message: "Order cancelled successfully",
        data: order,
      });
    } catch (error) {
      logger.error("Cancel order controller error:", error);

      const statusCode = error.message.includes("not found")
        ? 404
        : error.message.includes("cannot")
          ? 400
          : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message || "Failed to cancel order",
      });
    }
  }

  async initiateReturn(req, res) {
    try {
      const { orderId } = req.params;
      const userId = req.user.userId;
      const { returnReason } = req.body;

      if (!returnReason) {
        return res.status(400).json({
          success: false,
          message: "Return reason is required",
        });
      }

      const order = await orderService.initiateReturn(
        orderId,
        userId,
        returnReason,
      );
      res.json({
        success: true,
        message: "Return request initaited successfully",
        data: order,
      });
    } catch (error) {
      logger.error("Initiate return controller error:", error);
      const statusCode = error.message.includes("not found")
        ? 404
        : error.message.includes("cannot")
          ? 400
          : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message || "Failed to initiate return",
      });
    }
  }

  async getOrderStats(req, res) {
    try {
      const userId = req.user.userId;

      const stats = await orderService.getOrderStats(userId);

      res.json({
        success: true,
        message: "Order statistics retrieved successfully",
        data: stats,
      });
    } catch (error) {
      logger.error("Get order stats controller error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to retrieve order status",
      });
    }
  }

  async trackOrder(req, res) {
    try {
      const { orderId } = req.params;
      const userId = req.user.userId;

      const order = await orderService.getOrder(orderId, userId);

      const trackingInfo = {
        orderNumber: order.orderNumber,
        status: order.status,
        tracking: order.tracking.trackingNumber,
        carrier: order.tracking.carrier,
        trackingUrl: order.tracking.trackingUrl,
        estimated: order.tracking.estimateDelivery,
        actualDelivery: order.tracking.actualDelivery,
        statusHistory: order.tracking.statusHistory,
      };

      res.json({
        success: true,
        message: "Order tracking information retrieved successfully",
        data: trackingInfo,
      });
    } catch (error) {
      logger.error("Track order controller error:", error);

      const statusCode = error.message === "Order not found" ? 404 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message || "Failed to retrieve tracking information",
      });
    }
  }

  // Webhook for payment confirmatio (called by Payment service)
  async confirmPayment(req, res) {
    try {
      const { orderId, transactionId, paymentDetails } = req.body;

      const order = await orderService.confirmPayment(orderId, {
        transactionId,
        details: paymentDetails,
      });
    } catch (error) {
      logger.error("Confirm payment controller error:", error);

      const statusCode = error.message === "Order not found" ? 404 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message || "Failed to confirm message",
      });
    }
  }

  async getOrderInternal(req, res) {
    try {
      const { orderId } = req.params;
      const order = await Order.findById(orderId);

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }
      res.json({
        success: true,
        message: "Order retrieved successfully",
        data: order,
      });
    } catch (error) {
      logger.error("Get order internal controller error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to retrieve order",
      });
    }
  }
  // Called internally by payment service
  async confirmPaymentInternal(req, res) {
    try {
      const { orderId } = req.params;
      const { transactionId, paymentDetails } = req.body;

      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      await order.confirmPayment(transactionId, paymentDetails || {});

      res.json({
        success: true,
        message: "Payment confirmed successfully",
        data: order,
      });
    } catch (error) {
      logger.error("Confirm payment internal controller error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to confirm payment",
      });
    }
  }

  async markPaymentFailedInternal(req, res) {
    try {
      const { orderId } = req.params;
      const { failureReason } = req.body;

      const order = Order.findById(orderId);
      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      order.payment.status = "failed";
      order.status = "payment_failed";
      order.tracking.statusHistory.push({
        status: "payment_failed",
        timestamp: failureReason || "Payment failed",
        updatedBy: "payment_service",
      });

      await order.save();

      res.json({
        success: true,
        message: "Order marked as payment failed",
        data: order,
      });
    } catch (error) {
      logger.error("Mark payment failed internal controller error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to mark payment as failed",
      });
    }
  }
}

module.exports = new OrderController();
