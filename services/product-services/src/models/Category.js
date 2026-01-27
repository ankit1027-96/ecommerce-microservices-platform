const mongoose = require("mongoose");


const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String, trim: true },
    parentCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    level: { type: Number, default: 0 },
    image: { url: String, publicId: String },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    metaData: {
      productCount: { type: Number, default: 0 },
      featuredProducts: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
      ],
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Virtual for subcategories
categorySchema.virtual("subCategories", {
  ref: "Category",
  localField: "_id",
  foreignField: "parentCategory",
});

// Pre-save middelware to generate slug 
categorySchema.pre("validate", function (next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }
  next();
});

// Static method to get category tree
categorySchema.statics.getCategoryTree = async function () {
  const categories = await this.find({ isActive: true })
     .sort({ level: 1, sortOrder: 1 })
     .lean()

  const categoryMap = {};
  const tree = [];

  // create map of quick lookup
  categories .forEach(category => {
    categoryMap[category._id] = { ...category, children: [] };
  })

  // Build tree structure
    categories.forEach(category => {    
        if(category.parentCategory) {
            if(categoryMap[category.parentCategory]) {
                categoryMap[category.parentCategory].children.push(categoryMap[category._id]);
            }
        } else {
            tree.push(categoryMap[category._id]);
        }
    });

    return tree;
}

module.exports = mongoose.model("Category", categorySchema);