const PAYMENT_STATUS = {
  CREATED: "created",
  INITIATED: "initiated",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
  REFUND_PENDING: "refund_pending",
  REFUNDED: "refunded",
  PARTIALLY_REFUNDED: "partially_refunded",
};

const PAYMENT_METHODS = {
  CARD: "card",
  UPI: "upi",
  NETBANKING: "netbanking",
  WALLET: "wallet",
  COD: "cod",
};

const PAYMENT_GATEWAY = {
  RAZORPAY: "razorpay",
  STRIPE: "stripe",
  COD: "cod",
  NONE: "none",
};

const REFUND_REASONS = {
  CUSTOMER_REQUESTS: "customer_request",
  ORDER_CANCELLED: "order_cancelled",
  ORDER_RETURNED: "order_returned",
  DUPLICATE_CHARGE: "duplicate_charge",
  fraud: "fraud",
  other: "other",
};

// Auto-select gateway based on payment methods
const METHOD_GATEWAY_MAP = {
  card: PAYMENT_GATEWAY.RAZORPAY,
  upi: PAYMENT_GATEWAY.RAZORPAY,
  NETBANKING: PAYMENT_GATEWAY.RAZORPAY,
  WALLET: PAYMENT_GATEWAY.RAZORPAY,
  cod: PAYMENT_GATEWAY.COD,
};

const PAYMENT_EXPIRY_MINUTES =
  parseInt(process.env.PAYMENT_EXPIRY_MINUTES) || 30;
const REFUND_PROCESSING_DAYS =
  parseInt(process.env.REFUND_PROCESSING_DAYS) || 5;
const MAX_RETRY_ATTEMPTS = parseInt(process.env.MAX_RETRY_ATTEMPTS) || 3;

module.exports = {
  PAYMENT_STATUS,
  PAYMENT_METHODS,
  PAYMENT_GATEWAY,
  REFUND_REASONS,
  METHOD_GATEWAY_MAP,
  PAYMENT_EXPIRY_MINUTES,
  REFUND_PROCESSING_DAYS,
  MAX_RETRY_ATTEMPTS,
};
