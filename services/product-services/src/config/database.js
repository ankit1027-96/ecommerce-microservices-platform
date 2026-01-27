const mongoose = require("mongoose");
const logger = require("./logger");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    logger.info(`MongoDB Connected: ${conn.connection.host}`);

    // Create text indexes fofr search
    await createSearchIndexes();

    return conn;
  } catch (error) {
    logger.error("Database connection error", error);
    process.exit(1);
  }
};

const createSearchIndexes = async () => {
  try {
    const Product = require("../models/Product");

    // Create text index for search
    await Product.createIndexes([
      {
        name: 1,
        description: 1,
        "brand.name": 1,
        "category.name": 1,
        tags: 1,
      },
    ]);

    // Create compound indexes for filtering
    await Product.createIndexes([
      { category: 1, price: 1 },
      { brand: 1, price: 1 },
      { isActive: 1, createdAt: -1 },
      { "inventory.quantity": 1, isActive },
    ]);

    logger.info("Search indexes created successfully");
  } catch (error) {
    logger.warn("Index creation warning:", error.message);
  }
};

module.exports = connectDB;
