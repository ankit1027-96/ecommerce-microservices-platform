const mongoose = require("mongoose");

const varientSchema = new mongoose.Schema({
  name: { type: String, required: true }, //e.g., Size, Color
  value: { type: String, required: true }, //e.g., Large, Red
  price: { type: Number, default: 0 }, // Aditional price for this varient
  inventory: {
    quantity: { type: Number, default: 0 },
    reserved: { type: Number, default: 0 },
  },
  sku: { type: String, unique: true, sparse: true },
  isActive: { type: Boolean, default: true },
});

const specificationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  value: { type: String, required: true },
  group: { type: String, default: "General" }, // Group specifications
});

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      text: true, // Enable text search
    },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: {
      type: String,
      required: true,
      text: true, // Enable text search
    },
    shortDescription: { type: String, maxLength: 500 },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      required: true,
      index: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
      index: true,
    },
    comparePrice: {
      type: Number, // Original price for discount calculation
      min: 0,
    },
    costPrice: {
      type: Number, // Cost price for profit calculation
      min: 0,
    },
    currency: {
      type: String,
      default: "INR",
    },
    images: [
      {
        url: { type: String, required: true },
        publicId: String,
        altText: String,
        isPrimary: { type: Boolean, default: false },
      },
    ],
    varients: [varientSchema],
    specification: [specificationSchema],
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    inventory: {
      quantity: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
      },
      reserved: {
        type: Number,
        default: 0,
        min: 0,
      },
      lowStockThreshold: {
        type: Number,
        default: 10,
      },
      trackQuantity: {
        type: Boolean,
        default: true,
      },
    },
    shipping: {
      weight: Number, // in grams
      dimensions: {
        length: Number,
        width: Number,
        height: Number,
      },
      shippingClass: {
        type: String,
        enum: ["standard", "heavy", "fragile"],
        default: "standard",
      },
      freeShipping: {
        type: Boolean,
        default: false,
      },
    },
    seo: {
      metaTitle: String,
      metaDescription: String,
      keywords: [String],
    },
    status: {
      type: String,
      enum: ["draft", "active", "inactive", "archived"],
      default: "active",
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    analytics: {
      views: { type: Number, default: 0 },
      purchases: { type: Number, default: 0 },
      averageRating: { type: Number, default: 0, min: 0, max: 5 },
      reviewCount: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
productSchema.index({ name: "text", description: "text", tags: "text" });
productSchema.index({ category: 1, price: 1 });
productSchema.index({ brand: 1, price: 1 });
productSchema.index({ isActive: 1, isFeatured: -1, createdAt: -1 });
productSchema.index({ "analytics.averageRating": -1 });

// Virtual for avalilable inventory
productSchema.virtual("availableInventory").get(function () {
  return Math.max(0, this.inventory.quantity - this.inventory.reserved);
});

// Virtual for discount precentage
productSchema.virtual("discountPercentage").get(function () {
  if (typeof this.comparePrice === "number" && this.comparePrice > this.price) {
    return Math.round(
      ((this.comparePrice - this.price) / this.comparePrice) * 100
    );
  }
  return 0;
});

// Virtual for in stock status
productSchema.virtual("inStock").get(function () {
  return this.availableInventory > 0 || !this.inventory.trackQuantity;
});

// Virtual for low stock status
productSchema.virtual("lowStock").get(function () {
  return (
    this.inventory.trackQuantity &&
    this.availableInventory <= this.inventory.lowStockThreshold &&
    this.availableInventory > 0
  );
});

// Pre-save middleware
productSchema.pre("validate", function (next) {
  // 1) Generate slug from name (before required validation)
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, ""); // trim dashes at start/end
  }

  // 2) Set primary image
  if (
    this.images &&
    this.images.length > 0 &&
    !this.images.some((img) => img.isPrimary)
  ) {
    this.images[0].isPrimary = true;
  }

  // 3) Auto-generate tags from name (and optionally category)
  if (this.name) {
    const existingTags = Array.isArray(this.tags) ? this.tags : [];
    const nameTags = this.name.toLowerCase().split(/\s+/);
    this.tags = [...new Set([...existingTags, ...nameTags])];
  }

  next();
});

// Static methods
productSchema.statics.findActiveProducts = function (filter = {}) {
  return this.find({ ...filter, isActive: true, status: "active" });
};

productSchema.statics.searchProducts = function (searchTerm, options = {}) {
  const {
    category,
    brand,
    minPrice,
    maxPrice,
    inStock = true,
    sortBy = "relevance",
    page = 1,
    limit = 20,
  } = options;

  let query = {
    isActive: true,
    status: "active,",
  };

  // Text search
  if (searchTerm) {
    query.$text = { $search: searchTerm };
  }

  // Filters
  if (category) query.category = category;
  if (brand) query.brand = brand;
  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = minPrice;
    if (maxPrice) query.price.$lte = maxPricel;
  }
  if (inStock) {
    query.$expr = {
      $gt: [{ $subtract: ["$inventory.quantity", "$inventory.reserved"] }, 0],
    };
  }

  // Sorting
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
    case "relevance":
    default:
      if (searchTerm) {
        sort = { score: { $meta: "textScore" } };
      } else {
        sort = { isFeatured: -1, createdAt: -1 };
      }
      break;
  }

  const skip = (page - 1) * limit;

  return this.find(query)
    .populate("category", "name slug")
    .populate("brand", "name slug")
    .sort(sort)
    .skip(skip)
    .limit(limit);
};

// Instance methods
productSchema.methods.updateAnalytics = function (type, value = 1) {
  if (type === "view") {
    this.analytics.views += value;
  } else if (type === "purchase") {
    this.analytics.purchases += value;
  } else if (type === "wishlist") {
    this.analytics.wishlistCount += value;
  }
  return this.save();
};

productSchema.methods.reserveStock = function (quantity) {
  if (this.availableInventory >= quantity) {
    this.inventory.reserved += quantity;
    return this.save();
  }
  throw new Error("Insufficient stock available");
};

productSchema.methods.releaseStock = function (quantity) {
  if (
    (this.inventory.reserved = Math.max(0, this.inventory.reserved - quantity))
  )
    return this.save();
};

module.exports = mongoose.model("Product", productSchema);
