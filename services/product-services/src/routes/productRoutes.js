const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const { optionAuth } = require("../middleware/auth");
const rateLimit = require("express-rate-limit");

// Rate limiting for search
const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, //1min
  max: 30, // searched per min
  message: {
    success: false,
    message: "Too many requests, please try again later",
  },
});

// Public routes
router.get("/", productController.getProducts);
router.get("/search", searchLimiter, productController.searchProducts);
router.get("/featured", productController.getFeaturedProducts);
router.get("/popular", productController.getFeaturedProducts);
router.get("/:id", productController.getProductById);
router.get("/:id/related", productController.getRelatedProducts);

module.exports = router;
