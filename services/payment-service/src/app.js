const express = require("express");
const helmet = require("helmet");
const compression = require("compression");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const logger = require("./config/logger");
const paymentRoutes = require("./routes/paymentRoutes");
const { errorHandler, notFound } = require("./middleware/errorHandler");
const morgan = require("morgan");

const app = express();
app.set("trust-proxy", 1);

// Health check 
app.get("/health", (req, res) => {
  res.status(200).json({ success: true, message: "Payment service healthy" });
});

// Webhooks new rawbody for signature verification
app.use("/api/payments/webhook", (req, res, next) => {
  express.raw({ type: "application/json" })(req, res, (err) => {
    if (err) return next(err);
    req.rawBody = req.body;
    try {
      req.body = JSON.parse(req.rawBody);
    } catch {
      req.body = {};
    }
    next();
  });
});

// Middleware in order
app.use(helmet());
app.use(compression());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",")
      : ["http://localhost:3000", "http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Idempotency-Key"],
    credentials: true,
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(
  morgan("combined", { stream: { write: (msg) => logger.info(msg.trim()) } }),
);

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  legacyHeaders: false,
  standardHeaders: true,
  message: {
    success: false,
    error: "Too many requests, please try again later",
  },
});

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  legacyHeaders: false,
  standardHeaders: true,
  message: {
    success: false,
    error: "Too many payment attempts, please try again later.",
  },
});

app.use(generalLimiter);
app.use("/api/payments/initiate", paymentLimiter);
app.use("/api/payments", paymentRoutes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
