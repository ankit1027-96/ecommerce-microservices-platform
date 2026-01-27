const productService = require("../services/productService");
const logger = require("../config/logger");

class ProductController {
  async getProducts(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        category,
        brand,
        minPrice,
        maxPrice,
        inStock,
        sortBy = "newest",
        search,
      } = req.query;

      // Validate and sanitize inputs
      const options = {
        page: Math.max(1, parseInt(page)),
        limit: Math.min(100, Math.max(1, parseInt(limit))),
        sortBy,
      };

      if (category) options.category = category;
      if (brand) options.brand = brand;
      if (minPrice) options.minPrice = parseFloat(minPrice);
      if (maxPrice) options.maxPrice = parseFloat(maxPrice);
      if (inStock !== undefined) options.inStock = inStock === "true";
      if (search) options.search = search.trim();

      const result = await productService.getProducts(options);

      res.json({
        success: true,
        message: "Products retrieved successfully",
        data: result,
      });
    } catch (error) {
      logger.error("Get products controller error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to retrieve products",
      });
    }
  }

  async getProductById(req, res) {
    try {
      const { id } = req.params;

      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          message: "Invalid product ID format",
        });
      }

      const product = await productService.getProductById(id);

      res.json({
        success: true,
        message: "Product retrieved successfully",
        data: product,
      });
    } catch (error) {
      logger.error("Get product by ID controller error:", error);
      const statusCode = error.message === "Product not found" ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || "Failed to retrieve product",
      });
    }
  }

  async searchProducts(req, res) {
    try {
      const { q: searchTerm, ...options } = req.query;

      if (!searchTerm || searchTerm.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: "Search term must be at least 2 characters long",
        });
      }

      // Sanitize search term
      const sanitizedSearch = searchTerm.trim().replace(/[^\w\s-]/g, "");

      const results = await productService.searchProducts(sanitizedSearch, {
        page: Math.max(1, parseInt(options.page) || 1),
        limit: Math.min(50, Math.max(1, parseInt(options.limit) || 20)),
        category: options.category,
        brand: options.brand,
        minPrice: options.minPrice ? parseFloat(options.minPrice) : undefined,
        maxPrice: options.maxPrice ? parseFloat(options.maxPrice) : undefined,
        sortBy: options.sortBy || "relevance",
      });

      res.json({
        success: true,
        message: "Search completed successfully",
        data: results,
        searchTerm: sanitizedSearch,
      });
    } catch (error) {
      logger.error("Search products controller error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Search failed",
      });
    }
  }

  async getRelatedProducts(req, res) {
    try {
      const { id } = req.params;
      const { limit = 8 } = req.query;

      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          message: "Invalid product ID format",
        });
      }

      const relatedProducts = await productService.getRelatedProducts(
        id,
        Math.min(20, Math.max(1, parseInt(limit)))
      );

      res.json({
        success: true,
        message: "Related products retrieved successfully",
        data: relatedProducts,
      });
    } catch (error) {
      logger.error("Get related products controller error:", error);
      const statusCode = error.message === "Product not found" ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || "Failed to retrieve related products",
      });
    }
  }

  async getFeaturedProducts(req, res) {
    try {
      const { limit = 10 } = req.query;

      const products = await productService.getFeaturedProducts(
        Math.min(50, Math.max(1, parseInt(limit)))
      );

      res.json({
        success: true,
        message: "Featured products retrieved successfully",
        data: products,
      });
    } catch (error) {
      logger.error("Get featured products controller error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to retrieve featured products",
      });
    }
  }

  async getPopularProducts(req, res) {
    try {
      const { limit = 10 } = req.query;

      const products = await productService.getPopularProducts(
        Math.min(50, Math.max(1, parseInt(limit)))
      );

      res.json({
        success: true,
        message: "Popular products retrieved successfully",
        data: products,
      });
    } catch (error) {
      logger.error("Get popular products controller error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to retrieve popular products",
      });
    }
  }
}

module.exports = new ProductController();
