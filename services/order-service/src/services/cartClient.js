const axios = require("axios");
const logger = require("../config/logger");

class cartClient {
  constructor() {
    this.baseURL = process.env.API_GATEWAY_URL || "http:localhost:3000";
    this.timeout = 5000;
  }

  async getCart(userId, sessionId, headers = {}) {
    try {
      const requestHeaders = { ...headers };
      if (userId) {
        requestHeaders["X-User-Id"] = userId;
      }
      if (sessionId) {
        requestHeaders["X-Session-Id"] = sessionId;
      }

      const response = await axios.get(`${this.baseURL}/api/cart`, {
        headers: requestHeaders,
        timeout: this.timeout,
      });

      if (response.data.success && response.data.data) {
        return response.data.data;
      }

      throw new Error("Failed to retrieve cart");
    } catch (error) {
      logger.error("Cart client error:", error.message);

      if (error.code === "ECONNREFUSED") {
        throw new Error("Cart service unavailable");
      }

      throw new Error("Failed to fetch cart");
    }
  }

  async clearCart(userId, sessionId, headers = {}) {
    try {
      const requestHeaders = { ...headers };
      if (userId) {
        requestHeaders["X-User-Id"] = userId;
      }
      if (sessionId) {
        requestHeaders["X-Session-Id"] = sessionId;
      }

      const response = axios.delete(`${this.baseURL}/api/cart`, {
        headers: requestHeaders,
        timeout: this.timeout,
      });

      return (await response).data.success;
    } catch (error) {
      logger.error("Clear cart error:", error.message);
      return false; // Don't throw - clearing cart failure shouldn't block order
    }
  }
}

module.exports = new cartClient();
