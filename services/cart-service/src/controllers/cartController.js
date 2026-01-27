const cartService = require("../services/cartService");
const logger = require("../config/logger");

class CartController {
  async getCart(req, res) {
    try {
      const userId = req.user?.userId || null;
      const sessionId = req.sessionId || null;

      const cart = await cartService.getCart(userId, sessionId);

      res.json({
        success: true,
        message: "Cart retrieved successfully",
        data: cart,
      });
    } catch (error) {
      logger.error("Get cart controller error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to retrieve cart",
      });
    }
  }

  async addItem(req, res) {
    try {
      const userId = req.user?.userId || null;
      const sessionId = req.sessionId || null;
      const itemData = req.body;

      const cart = await cartService.addItemToCart(userId, sessionId, itemData);

      res.status(201).json({
        success: true,
        message: "Item added to cart successfully",
        data: cart,
      });
    } catch (error) {
      logger.error("Add item controller error:", error);

      const statusCode = error.message.includes("available") ? 400 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message || "Failed to add item to cart",
      });
    }
  }

  async updateItem(req, res) {
    try {
      const userId = req.user?.userId || null;
      const sessionId = req.sessionId || null;
      const { productId } = req.params;
      const { quantity } = req.body;
      const { variantId } = req.query;

      const cart = await cartService.updateCartItem(
        userId,
        sessionId,
        productId,
        variantId,
        quantity
      );

      res.json({
        success: true,
        message: "Cart item updated successfully",
        data: cart,
      });
    } catch (error) {
      logger.error("Update item controller error:", error);

      const statusCode =
        error.message.includes("available") ||
        error.message.includes("not found")
          ? 400
          : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message || "Failed to update cart item",
      });
    }
  }

  async removeItem(req, res) {
    try {
      const userId = req.user?.userId || null;
      const sessionId = req.sessionId || null;
      const { productId } = req.params;
      const { variantId } = req.query;

      const cart = await cartService.removeCartItem(
        userId,
        sessionId,
        productId,
        variantId
      );

      res.json({
        success: true,
        message: "Item removed from cart successfully",
        data: cart,
      });
    } catch (error) {
      logger.error("Remove item controller error:", error);

      const statusCode = error.message.includes("not found") ? 404 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message || "Failed to remove item from cart",
      });
    }
  }

  async clearCart(req, res) {
    try {
      const userId = req.user?.userId || null;
      const sessionId = req.sessionId || null;

      const cart = await cartService.clearCart(userId, sessionId);

      res.json({
        success: true,
        message: "Cart cleared successfully",
        data: cart,
      });
    } catch (error) {
      logger.error("Clear cart controller error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to clear cart",
      });
    }
  }

  async syncPrices(req, res) {
    try {
      const userId = req.user?.userId || null;
      const sessionId = req.sessionId || null;

      const cart = await cartService.syncCartPrices(userId, sessionId);

      res.json({
        success: true,
        message: "Cart prices synchronized successfully",
        data: cart,
      });
    } catch (error) {
      logger.error("Sync prices controller error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to sync cart prices",
      });
    }
  }

  async mergeCart(req, res) {
    try {
      if (!req.isAuthenticated || !req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required to merge carts",
        });
      }

      const userId = req.user.userId;
      const guestSessionId = req.body.guestSessionId || req.sessionId;

      const cart = await cartService.mergeGuestCart(guestSessionId, userId);

      if (!cart) {
        return res.json({
          success: true,
          message: "No guest cart to merge",
          data: null,
        });
      }

      res.json({
        success: true,
        message: "Guest cart merged successfully",
        data: cart,
      });
    } catch (error) {
      logger.error("Merge cart controller error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to merge carts",
      });
    }
  }

  async getCartSummary(req, res) {
    try {
      const userId = req.user?.userId || null;
      const sessionId = req.sessionId || null;

      const cart = await cartService.getCart(userId, sessionId);

      const summary = {
        itemCount: cart.metadata.itemCount,
        uniqueItems: cart.items.length,
        totals: cart.totals,
        isEmpty: cart.isEmpty,
        hasLowStockItems: cart.items.some(
          (item) => item.productSnapshot.availableQuantity < item.quantity
        ),
        hasOutOfStockItems: cart.items.some(
          (item) => !item.productSnapshot.inStock
        ),
      };

      res.json({
        success: true,
        message: "Cart summary retrieved successfully",
        data: summary,
      });
    } catch (error) {
      logger.error("Get cart summary controller error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to retrieve cart summary",
      });
    }
  }
}

module.exports = new CartController();
