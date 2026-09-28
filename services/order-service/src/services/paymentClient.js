const axios = require("axios");

const paymentClient = axios.create({
  baseURL: process.env.PAYMENT_SERVICE_URL,
  timeout: 5000,
  headers: { "X-Internal-Service": "order-service" },
});

exports.refundPayment = async (orderId, amount, reason) => {
  const { data } = await paymentClient.post(
    `/internal/payments/${orderId}/refund`,
    { amount, reason },
  );
  return data.data;
};
