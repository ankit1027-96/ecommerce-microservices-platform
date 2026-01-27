const morgan = require("morgan");
const logger = require("../config/logger");

// Custom token for user ID
morgan.token("user", (req) => {
  return req.user ? req.user.userId : "anonymous";
});

// Custom token for service
morgan.token("service", (req) => {
  const path = req.path;
  if (path.startsWith("/api/auth") || path.startsWith("/api/users"))
    return "user-service";
  if (path.startsWith("/api/products")) return "product-service";
  if (path.startsWith("/api/cart")) return "cart-service";
  if (path.startsWith("/api/orders")) return "order-service";
  if (path.startsWith("/api/payments")) return "payment-service";
  return "gateway";
});

const httpLogger = morgan(
  ":method :url :status :res[content-length] - :response-time ms [:user] -> :service",
  {
    stream: {
      write: (message) => {
        logger.info(message.trim());
      },
    },
  }
);

module.exports = httpLogger;
