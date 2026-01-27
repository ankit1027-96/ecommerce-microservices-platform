const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    variantId: {
      type: String,
      default: null,
    },
    name: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
      default: 1,
    },
    image: {
      type: String,
      default: null,
    },
    // Store product data snapshot for price consistency
    productSnapshot: {
      brand: String,
      category: String,
      inStock: Boolean,
      availableQuantity: Number,
    },
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      sparse: true,
      index: true,
    },
    sessionId: {
      type: String,
      sparse: true,
      index: true,
    },
    items: [cartItemSchema],
    totals: {
      subtotal: {
        type: Number,
        default: 0,
        min: 0,
      },
      tax: {
        type: Number,
        default: 0,
        min: 0,
      },
      shipping: {
        type: Number,
        default: 0,
        min: 0,
      },
      discount: {
        type: Number,
        default: 0,
        min: 0,
      },
      total: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    metadata: {
      itemCount: {
        type: Number,
        default: 0,
      },
      appliedCoupons: [
        {
          code: String,
          discountAmount: Number,
        },
      ],
      shippingAddress: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Address",
        default: null,
      },
    },
    status: {
      type: String,
      enum: ["active", "abandoned", "converted", "expired"],
      default: "active",
      index: true,
    },
    expiresAt: {
      type: Date,
      index: true,
    },
    lastActivity: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
cartSchema.index({ userId: 1, status: 1 });
cartSchema.index({ sessionId: 1, status: 1 });
cartSchema.index({ expireAfterSeconds: 0 }); // TTL index

// Virtual for checking if cart is empty
cartSchema.virtual("isEmpty").get(function () {
  return this.items.length === 0;
});

// Methods
cartSchema.methods.calculateTotals = function () {
  // Calculate subtotal
  this.totals.subtotal = this.items.reduce((sum, item) => {
    return sum + item.price * item.quantity;
  }, 0);

  // Calculate tax (18% GST in India)
  const taxRate = parseFloat(process.env.DEFAULT_TAX_RATE) || 0.18;
  this.totals.tax = Math.round(this.totals.subtotal * taxRate * 100) / 100;

  // Calculate shipping
  const freeShippingThreshold =
    parseFloat(process.env.FREE_SHIPPING_THRESHOLD) || 500;
  const standardShippingCost =
    parseFloat(process.env.STANDARD_SHIPPING_COST) || 50;

  if (this.totals.subtotal >= freeShippingThreshold) {
    this.totals.shipping = 0;
  } else {
    this.totals.shipping = standardShippingCost;
  }

  // Calculate total
  this.totals.total =
    this.totals.subtotal +
    this.totals.tax +
    this.totals.shipping -
    this.totals.discount;

  // Update item count
  this.metadata.itemCount = this.items.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  return this.totals;
};

cartSchema.methods.addItem = function (item) {
  const maxItems = parseInt(process.env.CART_MAX_ITEMS) || 50;

  if (this.items.length >= maxItems) {
    throw new Error(`Cart cannot have more than ${maxItems} different items`);
  }

  // Check if item already exists
  const existingItemIndex = this.items.findIndex(
    (i) =>
      i.productId.toString() === item.productId.toString() &&
      i.variantId === item.variantId
  );

  if (existingItemIndex > -1) {
    // Update quantity
    const maxQuantity = parseInt(process.env.CART_MAX_QUANTITY_PER_ITEM) || 10;
    const newQuantity = this.items[existingItemIndex].quantity + item.quantity;

    if (newQuantity > maxQuantity) {
      throw new Error(`Maximum quantity per item is ${maxQuantity}`);
    }

    this.items[existingItemIndex].quantity = newQuantity;
    this.items[existingItemIndex].price = item.price; // Update to latest price
  } else {
    // Add new item
    this.items.push(item);
  }

  this.lastActivity = new Date();
  this.calculateTotals();
};

cartSchema.methods.updateItem = function (productId, variantId, quantity) {
  const itemIndex = this.items.findIndex(
    (i) =>
      i.productId.toString() === productId.toString() &&
      i.variantId === variantId
  );

  if (itemIndex === -1) {
    throw new Error("Item not found in cart");
  }

  const maxQuantity = parseInt(process.env.CART_MAX_QUANTITY_PER_ITEM) || 10;
  if (quantity > maxQuantity) {
    throw new Error(`Maximum quantity per item is ${maxQuantity}`);
  }

  this.items[itemIndex].quantity = quantity;
  this.lastActivity = new Date();
  this.calculateTotals();
};

cartSchema.methods.removeItem = function (productId, variantId = null) {
  const itemIndex = this.items.findIndex(
    (i) =>
      i.productId.toString() === productId.toString() &&
      i.variantId === variantId
  );

  if (itemIndex === -1) {
    throw new Error("Item not found in cart");
  }

  this.items.splice(itemIndex, 1);
  this.lastActivity = new Date();
  this.calculateTotals();
};

cartSchema.methods.clear = function () {
  this.items = [];
  this.totals = {
    subtotal: 0,
    tax: 0,
    shipping: 0,
    discount: 0,
    total: 0,
  };
  this.metadata.itemCount = 0;
  this.lastActivity = new Date();
};

// Static methods
cartSchema.statics.findActiveCart = async function (userId, sessionId) {
  const query = {
    status: "active",
    $or: [],
  };

  if (userId) {
    query.$or.push({ userId });
  }
  if (sessionId) {
    query.$or.push({ sessionId });
  }

  if (query.$or.length === 0) {
    return null;
  }

  return this.findOne(query).sort({ updatedAt: -1 });
};

cartSchema.statics.createCart = async function (userId, sessionId) {
  const expiryDays = parseInt(process.env.CART_EXPIRY_DAYS) || 30;
  const guestExpiryHours = parseInt(process.env.GUEST_CART_EXPIRY_HOURS) || 24;

  const expiresAt = new Date();
  if (userId) {
    expiresAt.setDate(expiresAt.getDate() + expiryDays);
  } else {
    expiresAt.setHours(expiresAt.getHours() + guestExpiryHours);
  }

  return this.create({
    userId,
    sessionId,
    items: [],
    status: "active",
    expiresAt,
    lastActivity: new Date(),
  });
};

cartSchema.statics.mergeGuestCart = async function (guestSessionId, userId) {
  const guestCart = await this.findOne({
    sessionId: guestSessionId,
    status: "active",
  });
  if (!guestCart || guestCart.items.length === 0) {
    return null;
  }

  let userCart = await this.findOne({ userId, status: "active" });

  if (!userCart) {
    // Convert guest cart to user cart
    guestCart.userId = userId;
    guestCart.sessionId = null;
    const expiryDays = parseInt(process.env.CART_EXPIRY_DAYS) || 30;
    guestCart.expiresAt = new Date(
      Date.now() + expiryDays * 24 * 60 * 60 * 1000
    );
    await guestCart.save();
    return guestCart;
  }

  // Merge items from guest cart to user cart
  for (const guestItem of guestCart.items) {
    try {
      userCart.addItem(guestItem);
    } catch (error) {
      // Skip items that cause errors (e.g., max quantity reached)
      console.warn("Error merging item:", error.message);
    }
  }

  await userCart.save();

  // Mark guest cart as converted
  guestCart.status = "converted";
  await guestCart.save();

  return userCart;
};

module.exports = mongoose.model("Cart", cartSchema);
