// Order status transitions
const STATUS_TRANSITIONS = {
  pending: ["confirmed", "payment_failed", "cancelled"],
  payment_failed: ["pending", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["out_for_delivery", "delivered"],
  out_for_delivery: ["delivered", "returned"],
  delivered: ["returned"],
  cancelled: [], // Terminal state
  returned: ["refunded"],
  refunded: [], // Terminal state
};

isValidTransition = (currentStatus, newStatus) => {
  const allowedTransitions = STATUS_TRANSITIONS[currentStatus] || [];
  return allowedTransitions.includes(newStatus);
};

const getNextPossibleStatuses = (currentStatus) => {
  return STATUS_TRANSITIONS[currentStatus] || [];
};

module.exports = {
  STATUS_TRANSITIONS,
  isValidTransition,
  getNextPossibleStatuses,
};
