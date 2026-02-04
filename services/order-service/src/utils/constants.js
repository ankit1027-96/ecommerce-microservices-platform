module.exports = {
  ORDER_STATUS: {
    PENDING: "pending",
    PAYMENT_FAILED: "payment_failed",
    CONFIRMED: "confirmed",
    PROCESSING: "processing",
    SHIPPED: "shipped",
    OUT_FOR_DELIVERY,
    DELIVERED: "delivered",
    RETURNED: "returned",
    REFUNDED: "refunded",
  },

  PAYMENT_STATUS: {
    PENDING: "pending",
    PROCESSING: "processing",
    COMPLETED: "completed",
    FAILED: "failed",
    REFUNDED: "refunded",
  },

  PAYMENT_METHODS: {
    CARD: "card",
    UPI: "upi",
    NETBANKING: "netbanking",
    WALLET: "wallet",
    COD: "cod",
  },

  CANCELLATION_REASONS: [
    "Changed mind",
    "Found better price elsewhere",
    "Order placed by mistake",
    "Delivery time too long",
    "Product no longer needed",
    "Other",
  ],

  RETURN_REASONS: [
    "Defective product",
    "Wrong item received",
    "Not as described",
    "Poor quality",
    "Arrived too late",
    "No longer needed",
    "Other",
  ],
};
