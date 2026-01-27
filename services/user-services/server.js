require("dotenv").config();
const app = require("./src/app");
const connectDB = require("./src/config/database");

const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || "development";

// Connect DB
connectDB();

// Start Server
app.listen(PORT, () => {
  console.log(`User service running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});

// Start server function
const startServer = async () => {
  try {
    // Connect to database
    await connectDB();

    // Start the server
    const server = app.listen(PORT, () => {
      console.log("🚀 User Service Started Successfully!");
      console.log("=".repeat(50));
      console.log(`📍 Server running on port: ${PORT}`);
      console.log(`🌍 Environment: ${NODE_ENV}`);
      console.log(`📡 Health check: http://localhost:${PORT}/health`);
      console.log(`📚 API Base URL: http://localhost:${PORT}/api`);
      console.log("=".repeat(50));

      if (NODE_ENV === "development") {
        console.log("🔧 Development mode - Detailed logging enabled");
      }
    });

    // Graceful shutdown handlers
    const gracefulShutdown = async (signal) => {
      console.log(`\n🔄 Received ${signal}. Starting graceful shutdown...`);

      // Stop accepting new connections
      server.close(async (err) => {
        if (err) {
          console.error("Error during server shutdown:", err);
          process.exit(1);
        }

        console.log("✅ Server closed successfully");

        try {
          // Close database connection
          const mongoose = require("mongoose");
          await mongoose.connection.close();
          console.log("Database connection closed");

          console.log("Graceful shutdown completed");
          process.exit(0);
        } catch (error) {
          console.error("Error closing database connection:", error);
          process.exit(1);
        }
      });

      // Force close after 10 seconds
      setTimeout(() => {
        console.error(
          "Could not close connections in time, forcefully shutting down"
        );
        process.exit(1);
      }, 10000);
    };

    // Handle shutdown signals
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    // Handle uncaught exceptions
    process.on("uncaughtException", (error) => {
      console.error("Uncaught Exception:", error);
      gracefulShutdown("UNCAUGHT_EXCEPTION");
    });

    // Handle unhandled promise rejections
    process.on("unhandledRejection", (reason, promise) => {
      console.error("Unhandled Rejection at:", promise, "reason:", reason);
      gracefulShutdown("UNHANDLED_REJECTION");
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};
// Start the server
startServer();
