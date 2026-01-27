const rateLimit = require("express-rate-limit");

// General rate limiter
const generalLimiter = rateLimit({
  windowsMs: parseInt(process.env.RATE_LIMIT_WINDOWS_MS) || 15 * 60 * 1000, // 15 Minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000,
  message: {
    error: "Too many requests from this IP address, please try again later.",
    retryAfter: 15 * 60, // seconds
  },
});

const authLimiter = rateLimit({
  windowsMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMS
  message: {
    error: "Too many authentication attempts, please try again later.",
    retryAfter: 15 * 60, // seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const paymentLimiter = rateLimit({
  windowsMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: {
    error: "Too many payment attempts, please try again later",
    retryAfter: 15 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  generalLimiter,
  authLimiter,
  paymentLimiter,
};
