const { required } = require("joi");
const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, default: "India" },
    addressType: { type: String, enum: ["home", "work", "other"] },
  },
  { _id: false },
);

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    varientId: String,
    name: { type: String, required: true },
    slug: String,
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 0 },
    productSnapshot: {
      brand: String,
      category: String,
      sku: String,
    },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    userEmail: {
      type: String,
      required: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: function (items) {
          return items && items.length > 0;
        },
        message: "Order must contain at least one item",
      },
    },
    pricing: {
      subtotal: { type: Number, required: true, min: 0 },
      tax: { type: Number, required: true, min: 0 },
      shipping: { type: Number, required: true, min: 0 },
      discount: { type: Number, required: true, min: 0 },
      total: { type: Number, required: true, min: 0 },
    },
    shippingAddress: {
      type: addressSchema,
      required: true,
    },
    billingAddress: addressSchema,
    payment: {
      method: {
        type: String,
        enum: ["card", "upi", "netbanking", "wallet", "cod"],
        required: true,
      },
      status: {
        type: String,
        enum: ["pending", "processing", "completed", "failed"],
        default: "pending",
        index: true,
      },
      transactionId: String,
      paidAt: Date,
      paymentDetails: mongoose.Schema.Types.Mixed,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "payment_failed",
        "confirmed",
        "processing",
        "shipped",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "returned",
        "refunded",
      ],
      default: "pending",
      index: true,
    },
    tracking: {
      carrier: String,
      trackingNumber: String,
      trackingUrl: String,
      estimatedDelivery: Date,
      actualDelivery: Date,
      statusHistory: [
        {
          status: String,
          timestamp: { type: Date, default: Date.now },
          location: String,
          description: String,
          updatedBy: String,
        },
      ],
    },
    cancellation: {
      isCancelled: { type: Boolean, default: false },
      cancelledAt: Date,
      cancelledBy: { type: String, enum: ["user", "admin", "system"] },
      reason: String,
      refundStatus: {
        type: String,
        enum: ["not_initiated", "pending", "completed", "failed"],
      },
      refundAmount: Number,
    },
    return: {
      isReturned: { type: Boolean, default: false },
      returnRequestedAt: Date,
      returnReason: String,
      returStatus: {
        type: String,
        enum: ["requested", "approved", "rejected", "picked_up", "completed"],
      },
      refundInitiated: Boolean,
      refundAmount: Number,
    },
    notes: {
      customer: String,
      internal: String,
    },
    metadata: {
      ipAddress: String,
      userAgent: String,
      source: { type: String, default: "web" }, // web, mobile, admin
      couponCode: String,
      giftMessage: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ "payment.status": 1 });
orderSchema.index({ createdAt: -1 });

// Virtuals
orderSchema.virtual("itemCount").get(function () {
  return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

orderSchema.virtual("canCancel").get(function () {
  const cancellableStatuses = ["pending", "confirmed", "processing"];
  return (
    cancellableStatuses.includes(this.status) && !this.cancellation.isCancelled
  );
});

orderSchema.virtual("canReturn").get(function () {
  const returnableStatuses = ["delivered"];
  const daysSinceDelivery = this.tracking.actualDelivery
    ? (Date.now() - this.tracking.actualDelivery.getTime()) /
      (1000 * 60 * 60 * 24)
    : 999;
  return (
    returnableStatuses.includes(this.status) &&
    daysSinceDelivery <= 7 &&
    !this.return.isReturned
  );
});

orderSchema.virtual("isPaymentPending").get(function () {
  return (
    this.payment.status === "pending" || this.payment.status === "processing"
  );
});

// Instance methods
orderSchema.methods.updateStatus = function (
  newStatus,
  updatedBy = "system",
  description = "",
) {
  const oldStatus = this.status;
  this.status = newStatus;

  // Add to tracking history
  this.tracking.statusHistory.push({
    status: newStatus,
    timestamp: new Date(),
    description:
      description || `Order status changed from ${oldStatus} to ${newStatus}`,
    updatedBy,
  });

  return this.save();
};

orderSchema.methods.confirmPayment = function (
  transactionId,
  paymentDetails = {},
) {
  this.payment.status = "completed";
  this.payment.transactionId = transactionId;
  this.payment.paidAt = new Date();
  this.payment.paymentDetails = paymentDetails;
  this.status = "confirmed";

  this.tracking.statusHistory.push({
    status: "confirmed",
    timestamp: new Date(),
    description: "Payment confirmed, order is being processed",
    updatedBy: "payment_service",
  });

  return this.save();
};

orderSchema.methods.cancelOrder = function (reason, cancelledBy = "user") {
  if (!this.canCancel) {
    throw new Error("Order cannot be cancelled at this stage");
  }

  this.status = "cancelled";
  this.cancellation = {
    isCancelled: true,
    cancelledAt: new Date(),
    cancelledBy,
    reason,
    refundStatus:
      this.payment.status === "completed" ? "pending" : "not_initiated",
    refundAmount: this.payment.status === "completed" ? this.pricing.total : 0,
  };

  this.tracking.statusHistory.push({
    status: "cancelled",
    timestamp: new Date(),
    description: `Order cancelled: ${reason}`,
    updatedBy: cancelledBy,
  });

  return this.save();
};

orderSchema.methods.initiateReturn = function (returnReason) {
  if (!this.canReturn) {
    throw new Error("Order cannot be returned");
  }

  this.return = {
    isReturned: true,
    returnRequestedAt: new Date(),
    returnReason,
    returnStatus: "requested",
    refundInitiated: false,
    refundAmount: this.pricing.total,
  };

  this.tracking.statusHistory.push({
    status: "return_requested",
    timestamp: new Date(),
    description: `Return requested: ${returnReason}`,
    updatedBy: "user",
  });

  this.save();
};

// Static methods
orderSchema.statics.generateOrderNumber = async function () {
  const prefix = process.env.ORDER_PREFIX || "ORD";
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  const orderNumber = `${prefix}${timestamp}${random}`;

  // Ensure uniqueness
  const exists = await this.findOne({ orderNumber });
  if (exists) {
    return this.generateOrderNumber(); // Recursive call if collision
  }

  return orderNumber;
};

orderSchema.statics.findUserOrders = function (userId, options = {}) {
  const {
    status,
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = options;

  const query = { userId };
  if (status) {
    query.status = status;
  }

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

  return this.find(query).sort(sort).skip(skip).limit(limit);
};

orderSchema.statics.getOrderStats = async function (userId) {
  const stats = await this.aggregate([
    { $match: { userId: mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalSpent: { $sum: "$pricing.total" },
        completedOrders: {
          $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
        },
        cancelledOrders: {
          $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
        },
      },
    },
  ]);

  return (
    stats[0] || {
      totalOrders: 0,
      totalSpent: 0,
      completedOrders: 0,
      cancelledOrders: 0,
    }
  );
};

module.exports = mongoose.model("Order", orderSchema);
