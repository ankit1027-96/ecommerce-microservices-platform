const Joi = require("joi");
const logger = require("../config/logger");
const { PAYMNENT_METHODS } = require("../utils/constants");

const validate = (schema, property = "body") => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
      }));

      logger.warn("Validation error:", { errors, data: req[property] });

      return req.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }
    req[property] = value;
    next();
  };
};

// Address schema
const addressSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(100).required(),
  phone: Joi.string()
    .pattern(/^[0-9]{10}$/)
    .required()
    .messages({
      "string.pattern.base": "Phone number must be 10 digits",
    }),
  street: Joi.string().trim().min(5).max(100).required(),
  city: Joi.string().trim().min(2).max(100).required(),
  state: Joi.string().trim().min(2).max(100).required(),
  zipCode: Joi.string()
    .pattern(/^[0-9]{6}$/)
    .required()
    .messages({
      "string.pattern.base": "Zip code must be 6 digits",
    }),
  country: Joi.string().trim().default("India"),
  addressType: Joi.string().valid("home", "work", "other").default("home"),
});

// create order validation
const createOrderSchema = Joi.object({
  shippingAddress: addressSchema.required(),
  billingAddress: addressSchema.optional(),
  paymentMethod: Joi.string()
    .valid(...Object.values(PAYMENT_METHODS))
    .required(),
  sessionId: Joi.string().max(500).optional(),
  notes: Joi.object({
    customer: Joi.string().max(500).optional(),
  }).optional(),
  metadata: Joi.object({
    source: Joi.string().valid("web", "mobile", "admin").default("web"),
  }).optional,
});

// Cancel order validation
const cancelOrderSchema = Joi.object({
  reason: Joi.string().trim().min(5).max(500).required().messages({
    "string.min": "Please provide a detailed reason (at least 5 characters)",
    "any.required": "Cancellation reason is required",
  }),
});

// Return order validation
const returnOrderSchema = Joi.object({
  returnReason: Joi.string().trim().min(5).max(500).required().messages({
    "string.min": "Please provide a detailed reason (at least 5 characters)",
    "any.required": "Order ID is required",
  }),
});

// Order ID validation
const OrderIdSchema = Joi.object({
    orderId: Joi.string().length(24).hex().required()
        .messages({
            'string.length': 'Invalid order ID format',
            'any.required': 'Order ID is required'
        })
})

// Order query validation
const orderQuerySchema = Joi.object({
  status: Joi.string()
    .valid(
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
    )
    .optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(10),
  sortBy: Joi.string().valid("createdAt", "updatedAt", "total"),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
});

// Payment confirmation validation
const confirmPaymentSchema = Joi.object({
  orderId: Joi.string().length(24).hex().required(),
  transactionId: Joi.string().required(),
  paymentDetails: Joi.object().optional(),
});

const validateCreateOrder = validate(createOrderSchema, "body");
const validateCancelOrder = validate(cancelOrderSchema, "body");
const validateReturnOrder = validate(returnOrderSchema, "body");
const validateOrderId = validate(OrderIdSchema, "params");
const validateOrderQuery = validate(orderQuerySchema, "query");
const validateConfirmPayment = validate(confirmPaymentSchema, "body");

module.exports = {
  validate,
  validateCreateOrder,
  validateCancelOrder,
  validateReturnOrder,
  validateOrderId,
  validateOrderQuery,
  validateConfirmPayment,
};
