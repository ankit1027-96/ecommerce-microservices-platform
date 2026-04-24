require("dotenv").config();
const app = require("./src/app");

const connectDB = require("./src/config/database");
const redis = require("./src/config/redis");
const logger = require("./src/config/logger");

const PORT = process.env.PORT || 3005;
const NODE_ENV = process.env.NODE_ENV || "development";

const startServer = async () => {
  try {
    await connectDB();
    await redis.connect();

    const { startPaymentExpiryJob } = require("./src/jobs/paymentJobs");
    startPaymentExpiryJob();

    const server = app.listen(PORT, () => {
      console.log("💳 Payment Service Started Successfully!");
      console.log("=".repeat(60));
      console.log(`🚀 Server running on port: ${PORT}`);
      console.log(`🌍 Environment: ${NODE_ENV}`);
      console.log(`📊 MongoDB: ${process.env.MONGODB_URI}`);
      console.log(`⚡ Redis DB: ${process.env.REDIS_DB || 3}`);
      console.log(
        `💰 Gateways: ${[
          process.env.RAZORPAY_KEY_ID ? "Razorpay ✓" : "Razorpay ✗",
          process.env.STRIPE_SECRET_KEY ? "Stripe ✓" : "Stripe ✗",
        ].join(" | ")}`,
      );
      console.log("=".repeat(60));
    });

    const gracefullShutdown = async (signal) => {
      logger.info(`${signal} received. Shutting down gracefully...`);
      server.close(async () => {
        try {
          const mongoose = require("mongoose");
          await mongoose.connection.close();
          if (redis.client) await redis.client.quit();
          logger.info("Payment service shutdown cleanly");
          process.exit(0);
        } catch (err) {
          logger.error("Error during shutdown:", err);
          process.exit(1);
        }
      });
      setTimeout(() => {
        logger.error("Forced shutdown after timeout");
        process.exit(1);
      }, 10000);
    };
    process.on("SIGTERM", () => gracefullShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefullShutdown("SIGINT"));
    process.on("unhandledRejection", (reason) =>
      logger.error("Unhandled Rejection:", reason),
    );
    process.on("uncaughtException", (error) => {
      logger.error("Uncaught Exception:", error);
      gracefullShutdown("UNCAUGHT EXPRECTATION");
    });
  } catch (error) {
    logger.error("Failed to start Payment Service:", error);
    process.exit(1);
  }
};

startServer();
