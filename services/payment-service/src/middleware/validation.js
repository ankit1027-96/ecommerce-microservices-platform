const Joi = require("joi");

const schemas = {
  initiatePayment: Joi.object({
    orderId: Joi.string().required(),
    orderNumber: Joi.string().required(),
    amount: Joi.number().positive().required(),
    currency: Joi.string().uppercase().length(3).default("INR"),
    paymentMethod: Joi.string()
      .valid("card", "upi", "netbanking", "wallet", "cod")
      .required(),
  }),
  verifyRazorpay: Joi.object({
    razorpayOrderId: Joi.string().required(),
    razorpayPaymentId: Joi.string().required(),
    razorpaySignature: Joi.string().required(),
  }),

  initiateRefund: Joi.object({
    amount: Joi.number().positive().optional(),
    reason: Joi.string()
      .valid(
        "customer_request",
        "order_cancelled",
        "order_returned",
        "duplicate_charge",
        "fraud",
        "other",
      )
      .required(),
    notes: Joi.string().max(500).optional(),
  }),

  getPaymentHistory: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(10),
    status: Joi.string()
      .valid(
        "created",
        "initiated",
        "processing",
        "completed",
        "failed",
        "refund_pending",
        "refunded",
        "partially_refunded",
      )
      .optional(),
  }),
};

const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });
  if (error) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: error.details.map((d) => d.message),
    });
  }
  req.body = value;
  next();
};

const validateQuery = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.query, {
    abortEarly: false,
    stripUnknown: true,
  });
  if (error) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: error.details.map((d) => d.message),
    });
  }
  req.query = value;
  next();
};

module.exports = { schemas, validate, validateQuery };
