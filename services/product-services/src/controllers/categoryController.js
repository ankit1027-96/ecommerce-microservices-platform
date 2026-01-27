const Category = require("../models/Category");
const Product = require("../models/Product");
const cacheService = require("../services/cacheService");
const logger = require("../config/logger");

class CategoryController {
  async getCategories(req, res) {
    try {
      const { tree = "false", includeInactive = "false" } = req.query;

      const cacheKey = `categories_${tree}_${includeInactive}`;
      const cachedCategories = await cacheService.get("categories", cacheKey);
      if (cachedCategories) {
        return res.json({
          success: true,
          message: "Categories retrieved successfully",
          data: cachedCategories,
        });
      }

      let query = {};
      if (includeInactive !== "true") {
        query.isActive = true;
      }

      let categories;
      if (tree === "true") {
        categories = await Category.getCategoryTree();
      } else {
        categories = await Category.find(query)
          .populate("parentCategory", "name slug")
          .sort({ level: 1, sortOrder: 1 })
          .lean();
      }

      // Cache for 2 hours
      await cacheService.set("categories", cacheKey, categories, 7200);

      res.json({
        success: true,
        message: "Categories retrieved successfully",
        data: categories,
      });
    } catch (error) {
      logger.error("Get categories controller error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve categories",
      });
    }
  }

  async getCategoryById(req, res) {
    try {
      const { id } = req.params;
      const { includeProducts = "false", productLimit = 20 } = req.query;

      const category = await Category.findOne({
        _id: id,
        isActive: true,
      })
        .populate("parentCategory", "name slug")
        .lean();

      if (!category) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }

      // Include products if requested
      if (includeProducts === "true") {
        const products = await Product.find({
          category: id,
          isActive: true,
          status: "active",
        })
          .populate("brand", "name slug")
          .sort({ isFeatured: -1, "analytics.purchases": -1 })
          .limit(parseInt(productLimit))
          .lean();

        category.products = products;
      }

      res.json({
        success: true,
        message: "Category retrieved successfully",
        data: category,
      });
    } catch (error) {
      logger.error("Get category by ID controller error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve category",
      });
    }
  }
}

module.exports = new CategoryController();
