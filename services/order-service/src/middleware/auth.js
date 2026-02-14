const logger = require("../config/logger");

// Extract user information from API Gateway headers

const requireAuth = (req, res, next) => {
  try {
    const userId = req.headers["x-user-id"];
    const userEmail = req.headers["x-user-email"];
    const userRole = req.headers["x-user-role"];

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        error: "AUTHENTICATION_REQUIRED",
      });
    }

    req.user = {
      userId,
      email: userEmail,
      role: userRole || "user",
    };

    logger.debug("User authenticated:", { userId, email: userEmail });
    next();
  } catch (error) {
    logger.error("Auth middleware error:", error);
    return res.status(401).json({
      success: false,
      message: "Authentication failed",
      error: "AUTHENTICATION_FAILED",
    });
  }
};

// Admin authorization

const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication failed",
    });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required",
      error: "FORBIDDEn",
    });
  }
  next();
};

module.exports = {
  requireAuth,
  requireAdmin,
};
