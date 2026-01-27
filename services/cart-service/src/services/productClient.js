const axios = require("axios");
const logger = require("../config/logger");

class ProductClient {
  constructor() {
    this.baseURL = process.env.PRODUCT_SERVICE_URL || "http://localhost:3002";
    this.timeout = 5000;
  }

  async getProduct(productId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/api/products/${productId}`,
        { timeout: this.timeout }
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

      if (error.response?.status === 404) {
        throw new Error("Product not found");
      }

      if (error.code === "ECONNREFUSED") {
        throw new Error("Product service unavailable");
      }

      throw new Error("Failed to fetch product details");
    }
  }

  async getProducts(productIds) {
    try {
      const promises = productIds.map((id) => this.getProduct(id));
      const results = await Promise.allSettled(promises);

      return results.map((result, index) => ({
        productId: productIds[index],
        data: result.status === "fulfilled" ? result.value : null,
        error: result.status === "rejected" ? result.reason.message : null,
      }));
    } catch (error) {
      logger.error("Batch product fetch failed:", error);
      throw new Error("Failed to fetch products");
    }
  }

  async validateProduct(productId, quantity) {
    try {
      const product = await this.getProduct(productId);

      return {
        isvalid: true,
        product,
        availability: {
          inStock: product.inStock,
          availableQuantity: product.availableQuantity,
          canFulfill: product.availableQuantity >= quantity,
        },
      };
    } catch (error) {
      return {
        isValid: false,
        error: error.message,
      };
    }
  }
}

module.exports = new ProductClient();
