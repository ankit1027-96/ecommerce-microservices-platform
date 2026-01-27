const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");

const logger = require("./config/logger");
const { services } = require("./config/services");
const serviceRegistry = require("./utils/serviceRegistry");
const httpLogger = require("./middleware/logger");
const { errorHandler, notFound } = require("./middleware/errorHandler");
const {
  generalLimiter,
  authLimiter,
  paymentLimiter,
} = require("./middleware/rateLimiter");
const { authenticationToken, optionalAuth } = require("./middleware/auth");

const app = express();

// Trust proxy for rate limiting
app.set("trust proxy", 1);

// Basic middleware
app.use(helmet());
app.use(compression());
// app.use(express.json({ limit: "10mb" }));
// app.use(express.urlencoded({ extended: true }));

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
    : ["http://localhost:3000", "http://localhost:5173"],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};
app.use(cors(corsOptions));

// Logging
app.use(httpLogger);

// Rate limiting
app.use(generalLimiter);

// Health check for gateway
app.get("/health", (req, res) => {
  const serviceStatuses = serviceRegistry.getServiceStatus();
  const allServicesHealthy = Object.values(serviceStatuses).every(
    (status) => status === true
  );

  res.status(allServicesHealthy ? 200 : 503).json({
    success: true,
    message: "API Gateway is running",
    timestamp: new Date().toISOString(),
    services: serviceStatuses,
    overall: allServicesHealthy ? "healthy" : "degraded",
  });
});

// Service status endpoint
app.get("/api/status", (req, res) => {
  res.json({
    success: true,
    services: serviceRegistry.getServiceStatus(),
    timestamp: new Date().toISOString(),
  });
});

// Proxy configuration with authentication
const createAuthenticatedProxy = (target, requireAuth = true) => {
  return [
    requireAuth ? authenticationToken : optionalAuth,
    createProxyMiddleware({
      target,
      changeOrigin: true,
      selfHandleResponse: false,
      pathRewrite: (path, req) => req.originalUrl, // keep full URL
      onProxyReq: (proxyReq, req) => {
        if (req.user) {
          proxyReq.setHeader("X-User-Id", req.user.userId);
          proxyReq.setHeader("X-User-Email", req.user.email);
          proxyReq.setHeader("X-User-Role", req.user.role || "user");
        }
        // Forward session ID for guest users
        if (req.cookies?.sessionId) {
          proxyReq.setHeader("X-Session-Id", req.cookies.sessionId);
        }
      },
      onError: (err, req, res) => {
        logger.error("Proxy error:", err.message);
        res.status(503).json({
          success: false,
          message: "Service temporarily unavailable",
        });
      },
    }),
  ];
};

// For debugging
// app.use("/api/auth", (req, res, next) => {
//   console.log("Incoming to Gateway:", req.method, req.originalUrl);
//   next();
// });

// Route definitions with authentication
// Auth routes (with strict rate limiting)
app.use("/api/auth/login", authLimiter);

app.use("/api/auth/register", authLimiter);
app.use("/api/auth", ...createAuthenticatedProxy(services.user.url, false));

// User routes (require authentication)
app.use("/api/user", ...createAuthenticatedProxy(services.user.url, true));

// Product routes (optional authentication for personalization)
app.use(
  "/api/products",
  ...createAuthenticatedProxy(services.product.url, false)
);
app.use(
  "/api/categories",
  ...createAuthenticatedProxy(services.product.url, false)
);

// Cart routes (require authentication)
app.use("/api/cart", ...createAuthenticatedProxy(services.cart.url, true));

// Order routes (require authentication)
app.use("/api/orders", ...createAuthenticatedProxy(services.order.url, true));

// Payment routes (require authentication + strict rate limiting)
app.use("/api/payments", paymentLimiter);
app.use(
  "/api/payments",
  ...createAuthenticatedProxy(services.payment.url, true)
);

// Admin routes (require admin authentication)
app.use("/api/admin", authenticationToken, (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required",
    });
  }
  next();
});

// Catch-all for undefined routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Error handling
app.use(errorHandler);

module.exports = app;
