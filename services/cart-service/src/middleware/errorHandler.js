const logger = require('../config/logger');

const errorHandler = (error, req, res, next) => {
  logger.error('Cart Service Error:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    user: req.user,
    sessionId: req.sessionId
  });

  // Mongoose validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }))
    });
  }

  // Mongoose cast errors (invalid ObjectId)
  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format',
      error: 'INVALID_ID'
    });
  }

  // Custom business logic errors
  if (error.message.includes('not found')) {
    return res.status(404).json({
      success: false,
      message: error.message,
      error: 'NOT_FOUND'
    });
  }

  if (error.message.includes('unavailable')) {
    return res.status(503).json({
      success: false,
      message: error.message,
      error: 'SERVICE_UNAVAILABLE'
    });
  }

  // Default error
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    error: process.env.NODE_ENV === 'production' ? 'INTERNAL_ERROR' : error.stack
  });
};

const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.method} ${req.path} not found`,
    error: 'ENDPOINT_NOT_FOUND'
  });
};

module.exports = {
  errorHandler,
  notFound
};