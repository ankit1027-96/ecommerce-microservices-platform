const Joi = require("joi");

const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.details.map((detail) => ({
          field: detail.path.join("."),
          message: detail.message,
        })),
      });
    }
    next();
  };
};

//Validation Schemas
const registerSchema = Joi.object({
  firstName: Joi.string().min(2).max(20).required(),
  lastName: Joi.string().min(2).max(20).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  phone: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .required(),
  dateOfBirth: Joi.date().optional(),
  gender: Joi.string().valid("male", "female", "other").optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const updateProfileSchema = Joi.object({
  firstName: Joi.string().min(2).max(20).optional(),
  lastName: Joi.string().min(2).max(20).optional(),
  phone: Joi.string().pattern(/^[6-9]\d{9}$/),
  dateOfBirth: Joi.date().optional(),
  gender: Joi.string().valid("male", "female", "other").optional(),
});

const addAddressSchema = Joi.object({
  type: Joi.string().valid("home", "work", "other"),
  firstName: Joi.string().min(2).max(20).required(),
  lastName: Joi.string().min(2).max(20).required(),
  phone: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .required(),
  addressLine1: Joi.string().required(),
  addressLine2: Joi.string().required(),
  city: Joi.string().required(),
  state: Joi.string().required(),
  zipCode: Joi.string().required(),
  country: Joi.string().default("India"),
  isDefault: Joi.boolean().default(false),
});

module.exports = {
  validateRequest,
  registerSchema,
  loginSchema,
  updateProfileSchema,
  addAddressSchema,
};
