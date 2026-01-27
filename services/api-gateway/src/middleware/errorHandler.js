const logger = require("../config/logger");

const errorHandler = (error, req, res, next) => {
  logger.error("Gateway Error", {
    error: error.message,
    stack: error.stack,
    url: req.method,
    body: req.body,
    query: req.query,
    params: req.params,
  });

  if (error.code === "ECONNREFUSED") {
    return res.status(503).json({
      success: false,
      message: "Service temporarily unavailable",
      error: "SERVICE_UNAVAILABLE",
    });
  }

  if (error.code === "ENOTFOUND") {
    return res.status(502).json({
      success: false,
      message: "Service not found",
      error: "SERVICE_NOT_FOUND",
    });
  }

  // Default error
  res.status(error.status || 500).json({
    success: false,
    message: error.message || "Internal server error",
    error:
      process.env.NODE_ENV === "production" ? "INTERNAL_ERROR" : error.stack,
  });
};

const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.method} ${req.path} not found`,
    error: "ENDPOINT_NOT_FOUND",
  });
};

module.exports = {
  errorHandler,
  notFound,
};
