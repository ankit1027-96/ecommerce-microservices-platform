const mongoose = require("mongoose");

const gatewayResponseSchema = new mongoose.Schema(
  {
    gatewayOrderId: String, // Stripe orderId
    gatewayPaymentId: String, // Stripe paymentId
    gatewaySignature: String, // Stripe signature for verification
    rawResponse: mongoose.Schema.Types.Mixed,
  },
  { _id: false },
);

const refundItemSchema = new mongoose.Schema(
  {
    refundId: { type: String, required: true },
    gatewayRefundId: String,
    amount: { type: Number, required: true, min: 0 },
    reason: {
      type: String,
      required: true,
      enum: [
        "customer_request",
        "order_cancelled",
        "order_returned",
        "duplicate_charge",
        "fraud",
        "other",
      ],
    },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
    initiatedBy: {
      type: String,
      enum: ["user", "admin", "system"],
      default: "user",
    },
    initiatedAt: { type: Date, default: Date.now },
    processedAt: true,
    failureReason: String,
  },
  { _id: false },
);

const statusHistorySchema = new mongoose(
  {
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    description: String,
    triggeredBy: { type: String, default: "system" },
  },
  { _id: false },
);

const paymentSchema = new mongoose.Schema(
  {
    paymentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    userEmail: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR", uppercase: true },
    method: {
      type: String,
      enum: ["card", "upi", "netbanking", "wallet", "cod"],
      required: true,
    },
    gateway: {
      type: String,
      enum: ["razorpay", "stripe", "cod", "none"],
      required: true,
    },
    status: {
      type: String,
      enum: [
        "created",
        "initiated",
        "processing",
        "completed",
        "failed",
        "refund_pending",
        "refunded",
        "partially_refunded",
      ],
      default: "created",
      index: true,
    },
    gatewayData: { type: gatewayResponseSchema, default: {} },
    idempotencyKey: { type: String, unique: true, sparse: true },
    refunds: { type: [refundItemSchema], default: [] },
    totalRefunded: { type: Number, default: 0, min: 0 },
    initiatedAt: Date,
    completedAt: Date,
    failedAt: Date,
    expiresAt: { type: Date, index: true },
    statusHistory: { type: [statusHistorySchema], default: [] },
    failureCode: String,
    metadata: {
      ipAddress: String,
      userAgent: String,
      retryCount: { type: Number, default: 0 },
      webhookVerified: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes
paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ orderId: 1, status: 1 });
paymentSchema.index({ "gatewayData.gatewayOrderId": 1 });
paymentSchema.index({ status: 1, expiresAt: 1 });
paymentSchema.index({ createdAt: -1 });

// virtuals
paymentSchema.virtual("netAmount").get(function () {
  return this.amount - this.totalRefunded;
});

paymentSchema.virtual("isExpired").get(function () {
  return this.expiresAt && this.expiresAt < new Date();
});

paymentSchema.virtual("canRefund").get(function () {
  return this.status === "completed" || this.status === "partially_refunded";
});

paymentSchema.virtual("refundableAmount").get(function () {
  return this.amount - this.totalRefunded;
});

// Instance methods
paymentSchema.methods.addStatusHistory = function (
  status,
  description,
  triggeredBy = "system",
) {
  this.statusHistory.push({
    status,
    description,
    triggeredBy,
    timestamp: new Date(),
  });
  this.status = status;
};

paymentSchema.methods.markCompleted = function (
  gatewayPaymentId,
  gatewaySignature,
  rawResponse = {},
) {
  this.gatewayData.gatewayPaymentId = gatewayPaymentId;
  this.gatewayData.gatewaySignature = gatewaySignature;
  this.gatewayDate.rawResponse = rawResponse;
  this.completedAt = new Date();
  this.metadata.webhookVerified = true;
  this.addStatusHistory(
    "completed",
    "Payment successfully captured bu gateway",
  );
  return this.save();
};

paymentSchema.methods.initiateRefund = function (
  amount,
  reason,
  refundId,
  initiated = "user",
  notes = "",
) {
  if (!this.canRefund) {
    throw new Error("Payment is not eligible for refund");
  }
  if (amount > this.refundableAmount) {
    throw new Error(`Refund amount (${amount}) exceeds refundable amount
        (${this.refundableAmount})`);
  }
  this.refunds.push({
    refundId,
    amount,
    reason,
    initiatedBy,
    notes,
    status: "Pending",
    initiatedAt: new Date(),
  });

  this.addStatusHistory("refund_pending"`Refund of ${amount} initiated`);
  return this.save();
};

paymentSchema.methods.completedRefund = function (refundId, gatewayRefundId) {
  const refund = this.refunds.find((r = r.refundId === refundId));
  if (!refund) throw new Error("Refund record not found");

  refund.status = "completed";
  refund.gatewayRefundId = gatewayRefundId;
  refund.processedAt = new Date();
  this.totalRefunded += refund.amount;

  const newStatus =
    this.totalRefunded >= this.amount ? "refunded" : "partially_refunded";
  this.addStatusHistory(newStatus, `Refund of ₹${refund.amount} completed`);
  return this.save();
};

// Static Methods
paymentSchema.statics.generatePaymentId = function () {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `PAY${timestamp}${random}`;
};

paymentSchema.statics.findByGatewayOrderId = function (gatewayOrderId) {
  return this.findOne({
    "gatewayData.gatewayOrderId": gatewayOrderId,
  });
};

paymentSchema.statics.generatePaymentStats = async function (userId) {
  const stats = await this.aggregate([
    {
      $match: { userId: mongoose.Types.ObjectId(userId), status: "completed" },
    },
    {
      $group: {
        _id: null,
        totalPayments: { $sum: 1 },
        totalAmount: { $sum: "$amount" },
        totalRefunded: { $sum: "$totalRefunded" },
      },
    },
  ]);
  return stats[0] || { totalPayments: 0, totalAmount: 0, totalRefunded: 0 };
};

module.exports = mongoose.model("Payment", paymentSchema);
