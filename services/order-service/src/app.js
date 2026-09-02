const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");

const logger = require("./config/logger");
const redis = require("./config/redis");
const orderRoutes = require("./routes/orderRoutes");
const { errorHandler, notFound } = require("./middleware/errorHandler");

const app = express();

// Trust proxy
app.set("trust proxy", 1);

// Security middleware
app.use(helmet());
app.use(compression());

// Body Parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// CORS
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",")
      : [
          "http://localhost:3000",
          "http://localhost:5173",
          "http://localhost:3006",
        ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-User-Id",
      "X-User-Email",
      "X-User-Role",
    ],
    credentials: true,
  }),
);

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalLimiter);

// Health check
app.get("/health", async (req, res) => {
  const health = {
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "order-service",
    version: process.env.npm_package_version || "1.0.0",
  };

  // Check Redis connection
  try {
    if (!redis.client || redis.client.status !== "ready") {
      throw new Error(`Redis status: ${redis.client?.status}`);
    }

    await redis.client.ping();
    health.redis = "Connected";
  } catch (error) {
    console.error(error);
    health.redis = "Disconnected";
    health.status = "DEGRADED";
  }

  const statusCode = health.status === "OK" ? 200 : 503;
  res.status(statusCode).json(health);
});

// API routes
app.use("/api/orders", orderRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});
// Error handler
app.use(errorHandler);

module.exports = app;
