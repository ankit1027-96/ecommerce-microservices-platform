const Redis = require("ioredis");
const logger = require("./logger");

class RedisClient {
  constructor() {
    ((this.client = null), (this.isConnected = false));
  }

  async connect() {
    try {
      this.client = new Redis({
        host: process.env.REDIS_HOST || "localhost",
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: process.env.REDIS_DB || 3,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      this.client.on("connect", () => {
        ((this.isConnected = true),
          (logger.info = "Redis connected successfully"));
      });

      this.client.on("error", (error) => {
        ((this.isConnected = false),
          logger.error("Redis initialization error:", error));
      });

      await this.client.connect();
      return this.client;
    } catch (error) {
      logger.error("Redis connection error:", error);
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

  async set(key, value, ttl = null) {
    if (!this.isConnected) return false;
    try {
      const data = JSON.stringify(value);
      if (ttl) {
        await this.client.setex(key, ttl, data);
      } else {
        await this.client.set(key, data);
      }
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
    } catch (error) {
      logger.error("Redis DEL error:", error);
      return false;
    }
  }

  async exists(key) {
    if (!this.isConnected) return false;
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error("Redis EXISTS error:", error);
      return false;
    }
  }

  async setIdempetencyKey(key, value, ttl = 86400) {
    return this.set(`idempotency:${key}`, value, ttl);
  }

  async getIdempotencyKey(key) {
    return this.get(`idempotency:${key}`);
  }
}

module.exports = new RedisClient();
