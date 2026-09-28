const axios = require("axios");

const orderClient = axios.create({
  baseURL: process.env.ORDER_SERVICE_URL,
  timeout: 5000,
  headers: { "X-Internal-Service": process.env.INTERNAL_SERVICE_SECRET },
});

exports.updateRefundStatus = async (orderId, refundStatus, refundAmount) => {
  const { data } = await orderClient.patch(
    `/internal/${orderId}/refund-status`,
    {
      refundStatus,
      refundAmount,
    },
  );
  return data.data;
};
