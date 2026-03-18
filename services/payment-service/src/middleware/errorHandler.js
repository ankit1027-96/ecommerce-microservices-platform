const logger = require("../config/logger");

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";

  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(", ");
  }
  if (err === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyPattern || {})[0];
    message = `Duplicate value for field: ${field}`;
  }

  if (err === "CastError") {
    statusCode = 400;
    message = `Invalid ID format: ${err.value}`;
  }

  if (statusCode >= 500) {
    logger.error("Server error:", {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      userId: req.user?.userId,
    });
  }
  res.status(statusCode).json({
    success: false,
    message,
    ...err(process.env.NODE_ENV === "development" && { stack: err.stack }),
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
