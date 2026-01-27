const Redis = require("ioredis");
const logger = require("./logger");

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      this.client = new Redis({
        host: process.env.REDIS_HOST || "localhost",
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: process.env.REDIS_DB || 0,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      this.client.on("connect", () => {
        this.isConnected = true;
        logger.info("Redis connected successfully");
      });

      this.client.on("error", (error) => {
        this.isConnected = false;
        logger.error("Redis connection error:", error);
      });

      this.client.on("close", () => {
        this.isConnected = false;
        logger.warn("Redis connection closed");
      });

      await this.client.connect();
      return this.client;
    } catch (error) {
      logger.error("Redis initialization error:", error);
      return null;
    }
  }

  async get(key) {
    if (!this.isConnected) return null;
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error("Redis GET error:", error);
      return null;
    }
  }

  async set(key, value, ttl = 3600) {
    if (!this.isConnected) return false;
    try {
      const data = JSON.stringify(value);
      await this.client.setex(key, ttl, data);
      return true;
    } catch (error) {
      logger.error("Redis SET error:", error);
      return false;
    }
  }

  async del(key) {
    if (!this.isConnected) return false;
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error("Redis DEL error:", error);
      return false;
    }
  }

  async flushPattern(pattern) {
    if (!this.isConnected) return false;
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
      return true;
    } catch (error) {
      logger.error("Redis FLUSH error:", error);
      return false;
    }
  }
}

module.exports = new RedisClient();
