module.exports = {
  services: {
    user: {
      url: process.env.USER_SERVICE_URL || "http://localhost:3001",
      healthCheck: "/health",
    },
    product: {
      url: process.env.PRODUCT_SERVICE_URL || "http://localhost:3002",
      healthCheck: "/health",
    },
    cart: {
      url: process.env.CART_SERVICE_URL || "http://localhost:3003",
      healthCheck: "/health",
    },
    order: {
      url: process.env.ORDER_SERVICE_URL || "http://localhost:3004",
      healthCheck: "/health",
    },
    payment: {
      url: process.env.PAYMENT_SERVICE_URL || "http://localhost:3005",
      healthCheck: "/health",
    },
  },
};
