const Product = require("../models/Product");
const Category = require("../models/Category");
const Brand = require("../models/Brand");
const cacheService = require("./cacheService");
const logger = require("../config/logger");

class ProductService {
  async getProducts(options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        category,
        brand,
        minPrice,
        maxPrice,
        inStock = true,
        sortBy = "newest",
        search,
      } = options;

      // Generate cache key
      const cacheKey = JSON.stringify({
        page,
        limit,
        category,
        brand,
        minPrice,
        maxPrice,
        inStock,
        sortBy,
        search,
      });

      // Check cache first
      const cachedResult = await cacheService.getCachedProductList(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      // Build query
      let query = { isActive: true, status: "active" };

      if (search) {
        query.$text = { $search: search };
      }

      if (category) query.category = category;
      if (brand) query.brand = brand;

      if (minPrice || maxPrice) {
        query.price = {};
        if (minPrice) query.price.$gte = minPrice;
        if (maxPrice) query.price.$lte = maxPrice;
      }

      if (inStock) {
        query.$expr = {
          $gt: [
            { $subtract: ["$inventory.quantity", "$inventory.reserved"] },
            0,
          ],
        };
      }

      // Build sort
      let sort = {};
      switch (sortBy) {
        case "price_asc":
          sort = { price: 1 };
          break;
        case "price_desc":
          sort = { price: -1 };
          break;
        case "newest":
          sort = { createdAt: -1 };
          break;
        case "popularity":
          sort = { "analytics.purchases": -1, "analytics.views": -1 };
          break;
        case "rating":
          sort = { "analytics.averageRating": -1, "analytics.reviewCount": -1 };
          break;
        default:
          if (search) {
            sort = { score: { $meta: "textScore" } };
          } else {
            sort = { isFeatured: -1, createdAt: -1 };
          }
      }

      const skip = (page - 1) * limit;

      // Execute query
      const [products, totalCount] = await Promise.all([
        Product.find(query)
          .populate("category", "name slug")
          .populate("brand", "name slug")
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        Product.countDocuments(query),
      ]);

      const result = {
        products,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalItems: totalCount,
          itemsPerPage: limit,
          hasNextPage: page < Math.ceil(totalCount / limit),
          hasPrevPage: page > 1,
        },
      };

      // Cache the result
      await cacheService.cacheProductList(cacheKey, result, 1800); // 30 minutes

      return result;
    } catch (error) {
      logger.error("Get products error:", error);
      throw new Error("Failed to retrieve products");
    }
  }

  async getProductById(productId) {
    try {
      // Check cache first
      const cachedProduct = await cacheService.getCachedProduct(productId);
      if (cachedProduct) {
        return cachedProduct;
      }

      const product = await Product.findOne({
        _id: productId,
        isActive: true,
        status: "active",
      })
        .populate("category", "name slug parentCategory")
        .populate("brand", "name slug")
        .lean();

      if (!product) {
        throw new Error("Product not found");
      }

      // Increment view count (fire and forget)
      Product.findByIdAndUpdate(productId, { $inc: { "analytics.views": 1 } })
        .exec()
        .catch((err) => logger.error("View count update error:", err));

      // Cache the product
      await cacheService.cacheProduct(productId, product, 3600); // 1 hour

      return product;
    } catch (error) {
      logger.error("Get product by ID error:", error);
      throw error;
    }
  }

  async searchProducts(searchTerm, options = {}) {
    try {
      const cacheKey = JSON.stringify({ searchTerm, ...options });

      // Check cache
      const cachedResults = await cacheService.getCachedSearchResults(cacheKey);
      if (cachedResults) {
        return cachedResults;
      }

      const results = await this.getProducts({
        search: searchTerm,
        ...options,
      });

      // Cache search results
      await cacheService.cacheSearchResults(cacheKey, results, 1800); // 30 minutes

      return results;
    } catch (error) {
      logger.error("Search products error:", error);
      throw new Error("Search failed");
    }
  }

  async getRelatedProducts(productId, limit = 8) {
    try {
      const product = await Product.findById(productId)
        .select("category brand tags")
        .lean();
      if (!product) {
        throw new Error("Product not found");
      }

      const cacheKey = `related_${productId}_${limit}`;
      const cachedResults = await cacheService.get("recommendations", cacheKey);
      if (cachedResults) {
        return cachedResults;
      }

      // Find related products based on category, brand, and tags
      const relatedProducts = await Product.find({
        _id: { $ne: productId },
        isActive: true,
        status: "active",
        $or: [
          { category: product.category },
          { brand: product.brand },
          { tags: { $in: product.tags } },
        ],
      })
        .populate("category", "name slug")
        .populate("brand", "name slug")
        .sort({ "analytics.purchases": -1, "analytics.averageRating": -1 })
        .limit(limit)
        .lean();

      // Cache results
      await cacheService.set(
        "recommendations",
        cacheKey,
        relatedProducts,
        7200
      ); // 2 hours

      return relatedProducts;
    } catch (error) {
      logger.error("Get related products error:", error);
      throw error;
    }
  }

  async getFeaturedProducts(limit = 10) {
    try {
      const cacheKey = `featured_${limit}`;
      const cachedResults = await cacheService.getCachedProductList(cacheKey);
      if (cachedResults) {
        return cachedResults;
      }

      const products = await Product.find({
        isActive: true,
        status: "active",
        isFeatured: true,
      })
        .populate("category", "name slug")
        .populate("brand", "name slug")
        .sort({ "analytics.averageRating": -1, "analytics.purchases": -1 })
        .limit(limit)
        .lean();

      // Cache for longer since featured products don't change often
      await cacheService.cacheProductList(cacheKey, products, 7200); // 2 hours

      return products;
    } catch (error) {
      logger.error("Get featured products error:", error);
      throw new Error("Failed to get featured products");
    }
  }

  async getPopularProducts(limit = 10) {
    try {
      const cacheKey = `popular_${limit}`;
      const cachedResults = await cacheService.getCachedProductList(cacheKey);
      if (cachedResults) {
        return cachedResults;
      }

      const products = await Product.find({
        isActive: true,
        status: "active",
      })
        .populate("category", "name slug")
        .populate("brand", "name slug")
        .sort({ "analytics.purchases": -1, "analytics.views": -1 })
        .limit(limit)
        .lean();

      await cacheService.cacheProductList(cacheKey, products, 3600); // 1 hour

      return products;
    } catch (error) {
      logger.error("Get popular products error:", error);
      throw new Error("Failed to get popular products");
    }
  }

  async updateStock(productId, quantity, operation = "set") {
    try {
      const product = await Product.findById(productId);
      if (!product) {
        throw new Error("Product not found");
      }

      if (operation === "increment") {
        product.inventory.quantity += quantity;
      } else if (operation === "decrement") {
        product.inventory.quantity = Math.max(
          0,
          product.inventory.quantity - quantity
        );
      } else {
        product.inventory.quantity = quantity;
      }

      await product.save();

      // Invalidate cache
      await cacheService.invalidateProduct(productId);

      return product;
    } catch (error) {
      logger.error("Update stock error:", error);
      throw error;
    }
  }
}

module.exports = new ProductService();
