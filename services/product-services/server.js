require("dotenv").config();
const app = require("./src/app");
const connectDB = require("./src/config/database");
const redis = require("./src/config/redis");
const logger = require("./src/config/logger");

const PORT = process.env.PORT || 3002;
const NODE_ENV = process.env.NODE_ENV || "development";

const startServer = async () => {
  try {
    // Connect to DB
    await connectDB();
    await redis.connect();

    const server = app.listen(PORT, () => {
      console.log("🛍️  Product Service Started Successfully!");
      console.log("=".repeat(60));
      console.log(`🚀 Server running on port: ${PORT}`);
      console.log(`🌍 Environment: ${NODE_ENV}`);
      console.log(`🔗 Service URL: http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`📱 Products API: http://localhost:${PORT}/api/products`);
      console.log(`📂 Categories API: http://localhost:${PORT}/api/categories`);
      console.log("=".repeat(60));

      logger.info("Product Service started successfully", {
        port: PORT,
        environment: NODE_ENV,
      });

      // Graceful shutdown
      const gracefulShutdown = async (signal) => {
        console.log(`\n🔄 Received ${signal}. Starting graceful shutdown...`);

        server.close(async (err) => {
          if (err) {
            logger.error("Error during server shutdown", err);
            process.exit(1);
          }

          try {
            // Close DB connections
            if (redis.client) {
              await redis.client.quit();
              logger.info("Redis connection closed");
            }

            logger.info("Product Service shutdown successfully");
            console.log("✅ Graceful shutdown completed");
            process.exit(0);
          } catch (error) {
            logger.error("Error during shutdown:", error);
            process.exit(1);
          }
        });

        // Force close after 10 seconds
        setTimeout(() => {
          logger.error(
            "Could not close connections in time, forcefully shutting down"
          );
          process.exit(1);
        }, 10000);
      };

      process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
      process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    });
  } catch (error) {
    logger.error("Failed to start Product Service:", error);
    process.exit(1);
  }
};

startServer();
