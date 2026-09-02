const Cart = require("../models/Cart");
const redis = require("../config/redis");
const productClient = require("./productClient");
const calculationService = require("./calculationService");
const logger = require("../config/logger");
const { v4: uuidv4 } = require("uuid");

class CartService {
  constructor() {
    this.redisTTL = 7 * 24 * 60 * 60; // 7 days in seconds
  }

  generateCacheKey(userId, sessionId) {
    if (userId) {
      return `cart:user:${userId}`;
    }
    return `cart:session:${sessionId}`;
  }

  async getCart(userId, sessionId) {
    try {
      // Try Redis first
      const cacheKey = this.generateCacheKey(userId, sessionId);
      const cachedCart = await redis.get(cacheKey);

      if (cachedCart) {
        logger.debug("Cart cache HIT:", cacheKey);
        return Cart.hydrate(cachedCart);
      }

      logger.debug("Cart cache MISS:", cacheKey);

      // Fallback to database
      let cart = await Cart.findActiveCart(userId, sessionId);

      if (!cart) {
        // Create new cart
        cart = await Cart.createCart(userId, sessionId);
        logger.info("Created new cart:", {
          userId,
          sessionId,
          cartId: cart._id,
        });
      }

      // Cache the cart
      await this.cacheCart(cart);

      return cart;
    } catch (error) {
      logger.error("Get cart error:", error);
      throw new Error("Failed to retrieve cart");
    }
  }

  async cacheCart(cart) {
    try {
      const userId = cart.userId;
      const sessionId = cart.sessionId;
      const cacheKey = this.generateCacheKey(userId, sessionId);

      await redis.set(cacheKey, cart.toObject(), this.redisTTL);
      logger.debug("Cart cached:", cacheKey);
    } catch (error) {
      logger.error("Cache cart error:", error);
      // Don't throw - caching failure shouldn't break the flow
    }
  }

  async invalidateCart(userId, sessionId) {
    try {
      const cacheKey = this.generateCacheKey(userId, sessionId);
      await redis.del(cacheKey);
      logger.debug("Cart cache invalidated:", cacheKey);
    } catch (error) {
      logger.error("Invalidate cart cache error:", error);
    }
  }

  async addItemToCart(userId, sessionId, itemData, retries = 2) {
    try {
      const validation = await productClient.validateProduct(
        itemData.productId,
        itemData.quantity,
      );
      if (!validation.isValid) throw new Error(validation.error);
      if (!validation.availability.canFulfill) {
        throw new Error(
          `Only ${validation.availability.availableQuantity} items available in stock`,
        );
      }

      const product = validation.product;
      const cart = await this.getCart(userId, sessionId);

      const cartItem = {
        productId: product._id,
        variantId: itemData.variantId || null,
        name: product.name,
        slug: product.slug,
        price: product.price,
        quantity: itemData.quantity,
        image: product.images?.length
          ? product.images.find((img) => img.isPrimary)?.url ||
            product.images[0].url
          : null,
        productSnapshot: {
          brand: product.brand?.name,
          category: product.category?.name,
          inStock: product.inStock,
          availableQuantity: product.availableQuantity,
        },
      };

      cart.addItem(cartItem);
      await cart.save();
      await this.cacheCart(cart);

      logger.info("Item added to cart:", {
        userId,
        sessionId,
        productId: itemData.productId,
        quantity: itemData.quantity,
      });
      return cart;
    } catch (error) {
      if (error.name === "VersionError" && retries > 0) {
        await this.invalidateCart(userId, sessionId);
        logger.warn(
          "Cart version conflict on add — cache invalidated, retrying:",
          { userId, retriesLeft: retries },
        );
        return this.addItemToCart(userId, sessionId, itemData, retries - 1);
      }
      logger.error("Add item to cart error:", error);
      throw error;
    }
  }

  async updateCartItem(
    userId,
    sessionId,
    productId,
    variantId,
    quantity,
    retries = 2,
  ) {
    try {
      const cart = await this.getCart(userId, sessionId);
      if (cart.isEmpty) throw new Error("Cart is empty");

      const validation = await productClient.validateProduct(
        productId,
        quantity,
      );
      if (!validation.isValid) throw new Error(validation.error);
      if (!validation.availability.canFulfill) {
        throw new Error(
          `Only ${validation.availability.availableQuantity} items available in stock`,
        );
      }

      cart.updateItem(productId, variantId, quantity);
      await cart.save();
      await this.cacheCart(cart);

      logger.info("Cart item updated:", {
        userId,
        sessionId,
        productId,
        quantity,
      });
      return cart;
    } catch (error) {
      if (error.name === "VersionError" && retries > 0) {
        await this.invalidateCart(userId, sessionId);
        logger.warn(
          "Cart version conflict on update — cache invalidated, retrying:",
          { userId, productId, retriesLeft: retries },
        );
        return this.updateCartItem(
          userId,
          sessionId,
          productId,
          variantId,
          quantity,
          retries - 1,
        );
      }
      logger.error("Update cart item error:", error);
      throw error;
    }
  }

  async removeCartItem(
    userId,
    sessionId,
    productId,
    variantId = null,
    retries = 2,
  ) {
    try {
      const cart = await this.getCart(userId, sessionId);
      if (cart.isEmpty) {
        throw new Error("Cart is empty");
      }
      cart.removeItem(productId, variantId);
      await cart.save();
      await this.cacheCart(cart);
      logger.info("Item removed from cart:", { userId, sessionId, productId });
      return cart;
    } catch (error) {
      if (error.name === "VersionError" && retries > 0) {
        await this.invalidateCart(userId, sessionId);
        logger.warn("Cart version conflict — cache invalidated, retrying:", {
          userId,
          productId,
          retriesLeft: retries,
        });
        return this.removeCartItem(
          userId,
          sessionId,
          productId,
          variantId,
          retries - 1,
        );
      }
      logger.error("Remove cart item error:", error);
      throw error;
    }
  }

  async clearCart(userId, sessionId, retries = 2) {
    try {
      const cart = await this.getCart(userId, sessionId);
      cart.clear();
      await cart.save();
      await this.cacheCart(cart);
      logger.info("Cart cleared:", { userId, sessionId });
      return cart;
    } catch (error) {
      if (error.name === "VersionError" && retries > 0) {
        await this.invalidateCart(userId, sessionId);
        logger.warn("Cart version conflict — cache invalidated, retrying:", {
          userId,
          sessionId,
          retriesLeft: retries,
        });
        return this.clearCart(userId, sessionId, retries - 1);
      }
      logger.error("Clear cart error:", error);
      throw error;
    }
  }

  async syncCartPrices(userId, sessionId, retries = 2) {
    try {
      const cart = await this.getCart(userId, sessionId);
      if (cart.isEmpty) return cart;

      const productIds = cart.items.map((item) => item.productId);
      const productResults = await productClient.getProducts(productIds);
      let updated = false;

      for (let i = 0; i < cart.items.length; i++) {
        const item = cart.items[i];
        const productResult = productResults.find(
          (p) => p.productId.toString() === item.productId.toString(),
        );
        if (productResult && productResult.data) {
          const product = productResult.data;
          if (item.price !== product.price) {
            cart.items[i].price = product.price;
            updated = true;
            logger.info("Price updated for cart item:", {
              productId: item.productId,
              oldPrice: item.price,
              newPrice: product.price,
            });
          }
          cart.items[i].productSnapshot.inStock = product.inStock;
          cart.items[i].productSnapshot.availableQuantity =
            product.availableQuantity;
        }
      }

      if (updated) {
        cart.calculateTotals();
        await cart.save();
        await this.cacheCart(cart);
      }
      return cart;
    } catch (error) {
      if (error.name === "VersionError" && retries > 0) {
        await this.invalidateCart(userId, sessionId);
        logger.warn(
          "Cart version conflict on sync — cache invalidated, retrying:",
          { userId, retriesLeft: retries },
        );
        return this.syncCartPrices(userId, sessionId, retries - 1);
      }
      logger.error("Sync cart prices error:", error);
      throw error;
    }
  }

  async mergeGuestCart(guestSessionId, userId) {
    try {
      const mergedCart = await Cart.mergeGuestCart(guestSessionId, userId);

      if (mergedCart) {
        // Invalidate old caches
        await this.invalidateCart(null, guestSessionId);
        await this.invalidateCart(userId, null);

        // Cache merged cart
        await this.cacheCart(mergedCart);

        logger.info("Guest cart merged:", { guestSessionId, userId });
      }

      return mergedCart;
    } catch (error) {
      logger.error("Merge guest cart error:", error);
      throw error;
    }
  }
}

module.exports = new CartService();
