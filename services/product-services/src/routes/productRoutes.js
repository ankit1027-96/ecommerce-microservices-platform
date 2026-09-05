const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const { requireInternalService } = require("../middleware/internalAuth"); // add this — mirrors Order service's pattern
const rateLimit = require("express-rate-limit");

const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: {
    success: false,
    message: "Too many requests, please try again later",
  },
});

// Public routes
router.get("/", productController.getProducts);
router.get("/search", searchLimiter, productController.searchProducts);
router.get("/featured", productController.getFeaturedProducts);
router.get("/popular", productController.getPopularProducts); // fixed: was calling getFeaturedProducts
router.get("/:id", productController.getProductById);
router.get("/:id/related", productController.getRelatedProducts);

// Internal service-to-service routes (stock management)
router.post(
  "/:id/reserve",
  requireInternalService,
  productController.reserveStock,
);
router.post(
  "/:id/release",
  requireInternalService,
  productController.releaseStock,
);
router.post(
  "/:id/decrement",
  requireInternalService,
  productController.decrementStock,
);

module.exports = router;
