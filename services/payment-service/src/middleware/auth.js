const logger = require("../config/logger");

const requireAuth = (req, res, next) => {
  const userId = req.headers["x-user-id"];
  const userEmail = req.headers["x-user-email"];
  const userRole = req.headers["x-user-role"] || "user";

  if (!userId || !userEmail) {
    return res
      .status(401)
      .json({ success: false, message: "Authentication required" });
  }

  req.user = { userId, email: userEmail, role: userRole };
  next();
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    logger.warn("Admin access denied:", {
      userId: req.user?.userId,
      path: req.path,
    });
    return req
      .status(403)
      .json({ success: false, message: "Admin access requiured" });
  }
  next();
};

const requireInternalService = (req, res, next) => {
  const internalHeader = req.headers["x-internal-service"];
  if (!internalHeader) {
    return res
      .status(403)
      .json({ success: false, message: "Internal service access only" });
  }
  next();
};

module.exports = { requireAuth, requireAdmin, requireInternalService };
