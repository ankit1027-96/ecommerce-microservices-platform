const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// Security middleware
// app.use(helmet());
// app.use(
//   cors({
//     origin: process.env.FRONTEND_URL || "http://localhost:3000",
//     credentials: true,
//   })
// );

// Rate limiting
const limiter = rateLimit({
  windowMS: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per windows
  message: {
    success: false,
    message: "Too many requests from this IP address, please try again later",
  },
});

app.use(limiter);

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Health checkpoint
app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "User service is healthy",
    timeStamp: new Date().toISOString(),
  });
});

// app.get("/api/auth/authtest", (req, res) => {
//   res.json({
//     success: true,
//     message: "Test route hit successfull",
//   });
// });
app.use((req, res, next) => {
  console.log("Incoming to User Service:", req.method, req.originalUrl);
  next();
});

// Api routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found user service",
  });
});

// Error handling middleware
app.use(errorHandler);

module.exports = app;
