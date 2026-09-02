const axios = require("axios");
const logger = require("../config/logger");

class ProductClient {
  constructor() {
    this.baseURL = process.env.PRODUCT_SERVICE_URL || "http:localhost:3002";
    this.timeout = 5000;

    this.internalHeaders = {
      "x-internal-service": "true",
      "Content-Type": "application/json",
    };
  }

  async getProduct(productId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/api/products/${productId}`,
        { timeout: this.timeout },
      );

      if (response.data.success && response.data.data) {
        return response.data.data;
      }

      throw new Error("Product not found");
    } catch (error) {
      logger.error("Product client error:", {
        productId,
        error: error.message,
      });

      if (error.response?.status === 404) {
        throw new Error("Product not found");
      }

      if (error.code === "ECONNREFUSED") {
        throw new Error("Product service unavailable");
      }
      throw new Error(`Failed to fetch product: ${productId}`);
    }
  }

  async reserveStock(productId, quantity) {
    try {
      const response = await axios.post(
        `${this.baseURL}/api/products/${productId}/reserve`,
        { quantity },
        {
          headers: this.internalHeaders,
          timeout: this.timeout,
        },
      );

      if (response.data.success) {
        logger.info("Stock reserved:", { productId, quantity });
        return true;
      }

      throw new Error(response.data.message || "Failed to reserve stock");
    } catch (error) {
      logger.error("Product client - reserveStock error:", {
        productId,
        quantity,
        error: error.message,
      });

      if (error.response?.status === 400) {
        throw new Error(error.response.data.message || "Insufficient stock");
      }
      if (error.code === "ECONNREFUSED") {
        throw new Error("Product service unavailable");
      }

      throw new Error("Failed to reserve stock");
    }
  }

  async releaseStock(productId, quantity) {
    try {
      const response = await axios.post(
        `${this.baseURL}/api/products/${productId}/release`,
        { quantity },
        {
          headers: this.internalHeaders,
          timeout: this.timeout,
        },
      );

      if (response.data.success) {
        logger.info("Stock released:", { productId, quantity });
        return true;
      }

      return false;
    } catch (error) {
      logger.error("Product client - releaseStock error:", {
        productId,
        quantity,
        error: error.message,
      });
      return false;
    }
  }

  async decrementStock(productId, quantity) {
    try {
      const response = await axios.post(
        `${this.baseURL}/api/products/${productId}/decrement`,
        { quantity },
        {
          headers: this.internalHeaders,
          timeout: this.timeout,
        },
      );

      if (response.data.success) {
        logger.info("Stock decremented:", { productId, quantity });
        return true;
      }

      throw new Error(response.data.message || "Failed to decrement stock");
    } catch (error) {
      logger.error("Product client - decrementStock error:", {
        productId,
        quantity,
        error: error.message,
      });

      if (error.code === "ECONNREFUSED") {
        throw new Error("Product service unavailable");
      }

      throw new Error("Failed to decrement stock");
    }
  }
}

module.exports = new ProductClient();
