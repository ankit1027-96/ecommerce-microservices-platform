const mongoose = require("mongoose");
const logger = require("./logger");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    logger.info(`MongoDB Connected: ${conn.connection.host}`);

    // Create indexes
    await createIndexes();

    return conn;
  } catch (error) {
    logger.error("Database connection error:", error);
    process.exit(1);
  }
};

const createIndexes = async () => {
  try {
    const Order = require("../models/order");

    await Order.createIndexes([
      { userId: 1, createdAt: -1 },
      { orderNumber: 1 },
      { status: 1, createdAt: -1 },
      { "payment.status": 1 },
      { "tracking.status": 1 },
    ]);

    logger.info("Order indexes created successfully");
  } catch (error) {
    logger.warn("Index creation warning:", error.message);
  }
};

module.exports = connectDB;
