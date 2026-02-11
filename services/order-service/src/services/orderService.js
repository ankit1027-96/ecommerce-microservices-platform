const Order = require("../models/order");
const redis = require("../config/redis");
const cartClient = require("./cartClient");
const inventoryService = require("./inventoryService");
const orderNumberGenerator = require("../utils/orderNumberGenerator");
const logger = require("../config/logger");

class OrderService {
  constructor() {
    this.cacheTTL = 3600; // 1 hour
  }

  generateCacheKey(userId, orderId = null) {
    if (orderId) {
      return `order:${orderId}`;
    } else {
      return `orders:user:${userId}`;
    }
  }

  async createOrder(userId, userEmail, orderData) {
    try {
      const {
        shippingAddress,
        billingAddress,
        paymentMethod,
        sessionId,
        notes,
      } = orderData;

      // Get cart data
      const cart = await cartClient.getCart(userId, sessionId);

      if (!cart || !cart.items || cart.items.length === 0) {
        throw new Error("Cart is empty");
      }

      // Generate order number
      const orderNumber = orderNumberGenerator.generate();

      // Prepare order data
      const orderItems = cart.items.map((item) => ({
        productId: item.productId,
        varientId: item.varientId,
        name: item.name,
        slug: item.slug,
        price: item.price,
        quantity: item.quantity,
        image: item.image,
        subTotal: item.price * item.quantity,
        productSnapshot: item.productSnapshot,
      }));

      // Create order
      const order = new Order({
        orderNumber,
        userId,
        userEmail,
        items: orderItems,
        pricing: {
          subTotal: cart.totals.subTotal,
          tax: cart.totals.tax,
          shipping: cart.totals.shipping,
          discount: cart.totals.discount || 0,
          total: cart.totals.total,
        },
        shippingAddress,
        billingAddress,
        payment: {
          method: paymentMethod,
          status: paymentMethod === "cod" ? "pending" : "'pending",
        },
        status: "pending",
        notes: {
          customer: notes?.customer || "",
          internal: "",
        },
        metadata: {
          source: orderData.metadata?.source || "web",
        },
      });

      // Reserve inventory
      try {
        await inventoryService.reserveInventory(
          order._id.toString(),
          orderItems,
        );
      } catch (error) {
        logger.error("Inventory reservation failed:", error);
        throw new Error("Some items are out of stock");
      }

      // Save order
      await order.save();

      // Clear cart
      cartClient
        .clearCart(userId, sessionId)
        .catch((err) => logger.error("Failed to clear cart:", err));

      // Cache the order
      await this.cacheOrder(order);

      logger.info("Order created successfully:", {
        orderId: order._id,
        orderNumber: order.orderNumber,
        userId,
        total: order.pricing.total,
      });

      return order;
    } catch (error) {
      logger.error("Create order error:", error);
      throw error;
    }
  }

  async getOrder(orderId, userId = null) {
    try {
      // Check cache
      const cacheKey = this.generateCacheKey(userId, orderId);
      const cachedOrder = await redis.get(cacheKey);

      if (cachedOrder) {
        logger.debug("Order cache HIT:", cacheKey);
        return cachedOrder;
      }

      logger.debug("Order cache MISS:", cacheKey);

      // Query Database
      const query = { _id: orderId };
      if (userId) {
        query.userId = userId;
      }

      const order = await Order.findOne(query);

      if (!order) {
        throw new Error("Order not found");
      }

      // Cache the order
      await this.cachedOrder(order);

      return order;
    } catch (error) {
      logger.error("Get order error:", error);
      throw error;
    }
  }

  async getUserOrders(userId, options = {}) {
    try {
      const {
        status,
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = options;
      const skip = (page - 1) * limit;
      const query = { userId };

      if (status) {
        query.status = status;
      }
      const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

      const [orders, totalCount] = await Promise.all([
        Order.find(query).sort(sort).skip(skip).limit(limit).lean(),
        Order.countDocuments(query),
      ]);

      return {
        orders,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalItem: totalCount,
          hasNextPage: page < Math.ceil(totalCount / limit),
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      logger.error("Get user orders error:", error);
      throw new Error("Failed to retrieve orders");
    }
  }

  async confirmPayment(orderId, paymentData) {
    try {
      const order = await Order.findById(orderId);

      if (!order) {
        throw new Error("Order not found");
      }

      if (order.payment.status === "completed") {
        logger.warn("Payment already confirmed:", orderId);
      }

      // Confirm payment
      await order.confirmPayment(
        paymentData.transactionId,
        paymentData.details,
      );

      // Confirm inventory (deduct from actual inventory)
      await inventoryService.confirmInventory(orderId);

      // invalidate cache
      await this.invalidateOrderCache(order._id, order.userId);

      logger.info("Payment confirmed", {
        orderId,
        transactionId: paymentData.transactionId,
      });

      return order;
    } catch (error) {
      logger.error("Confirm payment error:", error);
      throw error;
    }
  }

  async updateOrderStatus(orderId, newStatus, updatedBy = "system") {
    try {
      const order = await Order.findById(orderId);

      if (!order) {
        throw new Error("Order not found");
      }

      // Validate status transition
      const { isValidTransition } = require("../utils/statusTransitions");
      if (!isValidTransition(order.status, newStatus)) {
        throw new Error(
          `Cannot transition from ${order.staus} to ${newStatus}`,
        );
      }

      await order.updateStatus(newStatus, updatedBy, description);

      // invalidate cache
      await this.invalidateOrderCache(order._id, order.userId);

      logger.info("Order status updated:", {
        orderId,
        oldStatus: order.status,
        newStatus,
        updatedBy,
      });

      return order;
    } catch (error) {
      logger.error("Update order status error:", error);
      throw error;
    }
  }

  async cancelOrder(orderId, userId, reason, cancelledBy = "user") {
    try {
      const order = await Order.findOne({ _id: orderId, userId });

      if (!order) {
        throw new Error("Order not found");
      }

      if (!order.canCancel) {
        throw new Error("Order cannot be cancelled at this stage");
      }

      // Check cancellation window
      const hoursSinceOrder =
        (Date.now() - order.createdAt.getTime()) / (1000 * 60 * 60);
      const cancellationWindow = parseInt(
        process.env.ORDER_CANCELLATION_WINDOW_HOURS,
      );

      if (hoursSinceOrder > cancellationWindow && order.status !== "pending") {
        throw new Error(
          `Orders can only be cancelled within ${cancellationWindow} hours`,
        );
      }

      await order.cancelOrder(reason, cancelledBy);

      // Release inventory reservation
      await inventoryService.releaseReservations(orderId);

      // Invalidate cache
      await this.invalidateOrderCache(order._id, order.userId);

      logger.info("Order cancelled:", {
        orderId,
        userId,
        reason,
        cancelledBy,
      });

      return order;
    } catch (error) {
      logger.error("Cancel order error:", error);
      throw error;
    }
  }

  async initiateReturn(orderId, userId, returnReason) {
    try {
      const order = await Order.findOne({ _id: orderId, userId });

      if (!order) {
        throw new Error("Order not found");
      }

      if (!order.canReturn) {
        throw new Error("Order cannot be returned");
      }

      // Invalidate cache
      await this.invalidateOrderCache(order._id, order.userId);

      logger.info("Return initiated", orderId, userId, returnReason);

      return order;
    } catch (error) {
      logger.error("Initiate return error:", error);
      throw error;
    }
  }

  async getOrderStats(userId) {
    try {
      const stats = await Order.getOrderStats(userId);
      return stats;
    } catch (error) {
      logger.error("Get order stats error:", error);
      throw new Error("Failed to retrieve order statistics");
    }
  }

  async cacheOrder(order) {
    try {
      const cacheKey = this.generateCacheKey(order.userId, order._id);
      await redis.set(caches);
      logger.debug("Order cached:", cacheKey);
    } catch (error) {
      logger.error("Cache order error:", error);
    }
  }

  async invalidateOrderCache(orderId, userId) {
    try {
      const cacheKey = this.generateCacheKey(userId, orderId);
      await redis.del(cacheKey);
      logger.debug("Order cache invalidated:", cacheKey);
    } catch (error) {
      logger.error("Invalidate order cache error:", error);
    }
  }
}

module.exports = new OrderService();
