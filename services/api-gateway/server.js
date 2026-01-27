require("dotenv").config();
const app = require("./src/app");
const logger = require("./src/config/logger");

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";

const startServer = async () => {
  try {
    const server = app.listen(PORT, () => {
      console.log("🌟 API Gateway Started Successfully!");
      console.log("=".repeat(60));
      console.log(`🚀 Server running on port: ${PORT}`);
      console.log(`🌍 Environment: ${NODE_ENV}`);
      console.log(`🔗 Gateway URL: http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`📈 Service status: http://localhost:${PORT}/api/status`);
      console.log("=".repeat(60));

      logger.info("API Gateway started successfully", {
        port: PORT,
        environment: NODE_ENV,
      });
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
      console.log(`\n🔄 Received ${signal}. Starting graceful shutdown...`);

      server.close(async (err) => {
        if (err) {
          logger.error("Error during server shutdown:", err);
          process.exit(1);
        }

        logger.info("API Gateway shut down successfully");
        console.log("✅ Graceful shutdown completed");
        process.exit(0);
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
  } catch (error) {
    logger.error("Failed to start API Gateway:", error);
    process.exit(1);
  }
};

startServer();
