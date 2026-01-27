const redis = require("../config/redis");
const logger = require("../config/logger");
const { parse } = require("dotenv");

class CacheService {
  constructor() {
    this.defaultTTL = parseInt(process.env.CACHE_TTL) || 3600; // Default TTL of 1 hour
    this.keyPrefix = "product_service:";
  }

  generateKey(type, identifier, params = {}) {
    const paramString =
      Object.keys(params).length > 0
        ? `:${Buffer.from(JSON.stringify(params)).toString("base64")}`
        : "";
    return `${this.keyPrefix}${type}:${identifier}${paramString}`;
  }

  async get(type, identifier, params = {}) {
    try {
      const key = this.generateKey(type, identifier, params);
      const data = await redis.get(key);
      if (data) {
        logger.debug(`Cache HIT: ${key}`);
        return data;
      }
      logger.debug(`Cache MISS: ${key}`);
      return null;
    } catch (error) {
      logger.error("Cache GET error:", error);
      return null;
    }
  }

  async set(type, identifier, data, ttl = null, params = {}) {
    try {
      const key = this.generateKey(type, identifier, params);
      const cacheTTL = ttl || this.defaultTTL;
      await redis.set(key, data, cacheTTL);
      logger.debug(`Cache SET: ${key} (TTL: ${cacheTTL}s)`);
      return true;
    } catch (error) {
      logger.error("Cache SET error:", error);
      return false;
    }
  }

  async del(type, identifier, params = {}) {
    try {
      const key = this.generateKey(type, identifier, params);
      await redis.del(key);
      logger.debug(`Cache DEL: ${key}`);
      return true;
    } catch (error) {
      logger.error("Cache DEL error:", error);
      return false;
    }
  }

  async flush(pattern) {
    try {
      const fullPattern = `${this.keyPrefix}${pattern}*`;
      await redis.flushPattern(fullPattern);
      logger.info(`Cache FLUSH: ${fullPattern}`);
      return true;
    } catch (error) {
      logger.error("Cache FLUSH error:", error);
      return false;
    }
  }

  // Specific cache methods
  async cacheProduct(productId, productData, ttl = null) {
    return this.set("product", productId, productData, ttl);
  }

  async getCachedProduct(productId) {
    return this.get("product", productId);
  }

  async invalidateProduct(productId) {
    await this.del("product", productId);
    await this.flush("products_list");
    await this.flush("search");
    await this.flush("recommendations");
  }

  async cacheProductList(key, products, ttl = null) {
    return this.set("products_lists", key, products, ttl);
  }

  async getCachedProductList(key) {
    return this.get("products_list", key);
  }

  async cacheSearchResults(query, results, ttl = 1800) {
    return this.set("search", query, results, ttl);
  }

  async getCachedSearchResults(query) {
    return this.get("search", query);
  }
}

module.exports = new CacheService();
