const Cart = require('../models/Cart');
const redis = require('../config/redis');
const productClient = require('./productClient');
const calculationService = require('./calculationService');
const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');

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
        logger.debug('Cart cache HIT:', cacheKey);
        return cachedCart;
      }

      logger.debug('Cart cache MISS:', cacheKey);

      // Fallback to database
      let cart = await Cart.findActiveCart(userId, sessionId);

      if (!cart) {
        // Create new cart
        cart = await Cart.createCart(userId, sessionId);
        logger.info('Created new cart:', { userId, sessionId, cartId: cart._id });
      }

      // Cache the cart
      await this.cacheCart(cart);

      return cart;
    } catch (error) {
      logger.error('Get cart error:', error);
      throw new Error('Failed to retrieve cart');
    }
  }

  async cacheCart(cart) {
    try {
      const userId = cart.userId;
      const sessionId = cart.sessionId;
      const cacheKey = this.generateCacheKey(userId, sessionId);

      await redis.set(cacheKey, cart.toObject(), this.redisTTL);
      logger.debug('Cart cached:', cacheKey);
    } catch (error) {
      logger.error('Cache cart error:', error);
      // Don't throw - caching failure shouldn't break the flow
    }
  }

  async invalidateCart(userId, sessionId) {
    try {
      const cacheKey = this.generateCacheKey(userId, sessionId);
      await redis.del(cacheKey);
      logger.debug('Cart cache invalidated:', cacheKey);
    } catch (error) {
      logger.error('Invalidate cart cache error:', error);
    }
  }

  async addItemToCart(userId, sessionId, itemData) {
    try {
      // Validate product
      const validation = await productClient.validateProduct(
        itemData.productId,
        itemData.quantity
      );

      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      if (!validation.availability.canFulfill) {
        throw new Error(
          `Only ${validation.availability.availableQuantity} items available in stock`
        );
      }

      const product = validation.product;

      // Get or create cart
      const cart = await this.getCart(userId, sessionId);

      // Prepare cart item
      const cartItem = {
        productId: product._id,
        variantId: itemData.variantId || null,
        name: product.name,
        slug: product.slug,
        price: product.price,
        quantity: itemData.quantity,
        image: product.images && product.images.length > 0 
          ? product.images.find(img => img.isPrimary)?.url || product.images[0].url
          : null,
        productSnapshot: {
          brand: product.brand?.name,
          category: product.category?.name,
          inStock: product.inStock,
          availableQuantity: product.availableQuantity
        }
      };

      // Add item to cart
      cart.addItem(cartItem);

      // Save to database
      await cart.save();

      // Update cache
      await this.cacheCart(cart);

      logger.info('Item added to cart:', {
        userId,
        sessionId,
        productId: itemData.productId,
        quantity: itemData.quantity
      });

      return cart;
    } catch (error) {
      logger.error('Add item to cart error:', error);
      throw error;
    }
  }

  async updateCartItem(userId, sessionId, productId, variantId, quantity) {
    try {
      const cart = await this.getCart(userId, sessionId);

      if (cart.isEmpty) {
        throw new Error('Cart is empty');
      }

      // Validate product availability for new quantity
      const validation = await productClient.validateProduct(productId, quantity);

      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      if (!validation.availability.canFulfill) {
        throw new Error(
          `Only ${validation.availability.availableQuantity} items available in stock`
        );
      }

      // Update item
      cart.updateItem(productId, variantId, quantity);

      // Save and cache
      await cart.save();
      await this.cacheCart(cart);

      logger.info('Cart item updated:', {
        userId,
        sessionId,
        productId,
        quantity
      });

      return cart;
    } catch (error) {
      logger.error('Update cart item error:', error);
      throw error;
    }
  }

  async removeCartItem(userId, sessionId, productId, variantId = null) {
    try {
      const cart = await this.getCart(userId, sessionId);

      if (cart.isEmpty) {
        throw new Error('Cart is empty');
      }

      cart.removeItem(productId, variantId);

      await cart.save();
      await this.cacheCart(cart);

      
      logger.info('Item removed from cart:', {
        userId,
        sessionId,
        productId
      });

      return cart;
    } catch (error) {
      logger.error('Remove cart item error:', error);
      throw error;
    }
  }

  async clearCart(userId, sessionId) {
    try {
      const cart = await this.getCart(userId, sessionId);

      cart.clear();

      await cart.save();
      await this.cacheCart(cart);

      logger.info('Cart cleared:', { userId, sessionId });

      return cart;
    } catch (error) {
      logger.error('Clear cart error:', error);
      throw error;
    }
  }

  async syncCartPrices(userId, sessionId) {
    try {
      const cart = await this.getCart(userId, sessionId);

      if (cart.isEmpty) {
        return cart;
      }

      // Fetch current product data
      const productIds = cart.items.map(item => item.productId);
      const productResults = await productClient.getProducts(productIds);

      let updated = false;

      for (let i = 0; i < cart.items.length; i++) {
        const item = cart.items[i];
        const productResult = productResults.find(
          p => p.productId.toString() === item.productId.toString()
        );

        if (productResult && productResult.data) {
          const product = productResult.data;
          
          // Update price if changed
          if (item.price !== product.price) {
            cart.items[i].price = product.price;
            updated = true;
            logger.info('Price updated for cart item:', {
              productId: item.productId,
              oldPrice: item.price,
              newPrice: product.price
            });
          }

          // Update availability
          cart.items[i].productSnapshot.inStock = product.inStock;
          cart.items[i].productSnapshot.availableQuantity = product.availableQuantity;
        }
      }

      if (updated) {
        cart.calculateTotals();
        await cart.save();
        await this.cacheCart(cart);
      }

      return cart;
    } catch (error) {
      logger.error('Sync cart prices error:', error);
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

        logger.info('Guest cart merged:', { guestSessionId, userId });
      }

      return mergedCart;
    } catch (error) {
      logger.error('Merge guest cart error:', error);
      throw error;
    }
  }
}

module.exports = new CartService();