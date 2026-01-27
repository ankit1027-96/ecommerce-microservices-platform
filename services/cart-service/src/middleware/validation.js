const Joi = require('joi');
const logger = require('../config/logger');

const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      logger.warn('Validation error:', { errors, data: req[property] });

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    req[property] = value;
    next();
  };
};

// Add item to cart validation
const addItemSchema = Joi.object({
  productId: Joi.string().length(24).hex().required()
    .messages({
      'string.length': 'Invalid product ID format',
      'any.required': 'Product ID is required'
    }),
  variantId: Joi.string().optional().allow(null),
  quantity: Joi.number().integer().min(1).max(10).default(1)
    .messages({
      'number.min': 'Quantity must be at least 1',
      'number.max': 'Maximum quantity per item is 10'
    })
});

// Update cart item validation
const updateItemSchema = Joi.object({
  quantity: Joi.number().integer().min(1).max(10).required()
    .messages({
      'number.min': 'Quantity must be at least 1',
      'number.max': 'Maximum quantity per item is 10',
      'any.required': 'Quantity is required'
    })
});

// Remove item validation (params)
const removeItemSchema = Joi.object({
  productId: Joi.string().length(24).hex().required()
    .messages({
      'string.length': 'Invalid product ID format',
      'any.required': 'Product ID is required'
    })
});

// Query validation
const cartQuerySchema = Joi.object({
  variantId: Joi.string().optional()
});

const validateAddItem = validate(addItemSchema, 'body');
const validateUpdateItem = validate(updateItemSchema, 'body');
const validateRemoveItem = validate(removeItemSchema, 'params');
const validateCartQuery = validate(cartQuerySchema, 'query');

module.exports = {
  validate,
  validateAddItem,
  validateUpdateItem,
  validateRemoveItem,
  validateCartQuery
};