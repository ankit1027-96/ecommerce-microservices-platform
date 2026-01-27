const axios = require("axios");
const logger = require("../config/logger");
const { services } = require("../config/services");

const authenticationToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access token required",
      });
    }

    // Forward token validation to user service
    const response = await axios.get(
      `${services.user.url}/api/auth/verify-token`,
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000,
      }
    );

    if (response.data.success) {
      req.user = response.data.user;
      next();
    } else {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }
  } catch (error) {
    logger.error("Authentication error:", error.message);

    if (error.code === "ECONNREFUSED") {
      return res.status(503).json({
        success: false,
        message: "Authentication service unavailable",
      });
    }

    return res.status(401).json({
      success: false,
      message: "Token verification failed",
    });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (token) {
      const response = await axios.get(
        `${services.user.url}/api/auth/verify-token`,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 5000,
        }
      );

      if (response.data.success) {
        req.user = response.data.user;
      }
    }

    next();
  } catch (error) {
    // Continue without authentication for optional auth
    logger.warn("Optional auth failed:", error.message);
    next();
  }
};

module.exports = {
  authenticationToken,
  optionalAuth,
};
