const axios = require("axios");
const logger = require("../config/logger");

class OrderClient {
  constructor() {
    this.baseUrl = process.env.ORDER_SERVICE_URL || "http://localhost:3004";
    this.timeout = 5000;
  }

  _headers() {
    return {
      "Content-Type": "application/json",
      "X-Internal_Service": "payment_service",
    };
  }

  async getOrder(orderId) {
    try {
      logger.info(`OrderClient: fetching order ${orderId}`);
      const response = await axios.get(
        `${this.baseUrl}/api/orders/internal/${orderId}`,
        {
          headers: this._headers(),
          timeout: this.timeout,
        },
      );
      return response.data.data;
    } catch (error) {
      logger.error(`OrderClient.getOrder error for ${orderId}:`, error.message);
      if (error.response?.status === 404) throw new Error("Order not found");
      throw new Error("Order service unavailable");
    }
  }

  async confirmPayment(orderId, transactionId, paymentDetails) {
    try {
      logger.info(`OrderClient: confirming payment for order: ${orderId}`);
      const response = await axios.post(
        `${this.baseUrl}/api/orders/internal/${orderId}/confirm-payment`,
        {
          transactionId,
          paymentDetails,
        },
        { headers: this._headers(), timeout: this.timeout },
      );
      return response.data.data;
    } catch (error) {
      logger.error(
        `OrderClient.confirmPayment error for ${orderId}:`,
        error.message,
      );
      throw new Error("Failed to confirm payment with Order service");
    }
  }

  async markPaymentFailed(orderId, failureReason) {
    try {
      logger.info(`OrderClient: marking payment failed for order ${orderId}`);
      const response = await axios.post(
        `${this.baseUrl}/api/orders/internal/${orderId}/payment-failed`,
        { failureReason },
        { headers: this._headers, timeout: this.timeout },
      );
      return response.data.data;
    } catch (error) {
      logger.error(
        `OrderClient.markPaymentFailed error for ${orderId}:`,
        error.message,
      );
    }
  }
}
module.exports = OrderClient();
