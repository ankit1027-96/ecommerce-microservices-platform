const { default: axios } = require("axios");

class ProductClient {
  constructor() {
    this.baseURL = process.env.API_GATEWAY_URL || "http:localhost:3000";
    this.timeout = 5000;
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
      throw new Error(`Failed to fetch product: ${productId}`);
    }
  }

  async reserveStock(productId, quantity) {
    try {
      logger.info("Reserving stock:", { productId, quantity });
    } catch (error) {
      logger.error("Reserve stock error:", error);
      throw new Error("Failed to reserve stock");
    }
  }

  async releaseStock(productId, quantity) {
    try {
      logger.info("Releasing stock:", { productId, quantity });
      return true;
    } catch (error) {
      logger.error("Release stock error:", error);
      return false;
    }
  }

  async decrementStock(productId, quantity) {
    try {
      logger.info("Decrementing stock:", { productId, quantity });
    } catch (error) {
      logger.error("Decrement stock error:", error);
      throw new Error("Failed to decrement stock");
    }
  }
}

module.exports = new ProductClient();
