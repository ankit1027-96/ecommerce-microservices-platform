const express = require("express");
const userController = require("../controllers/userController");
const { authenticateToken } = require("../middleware/auth");
const {
  validateRequest,
  updateProfileSchema,
  addAddressSchema,
} = require("../middleware/validation");
const Joi = require("joi");

const router = express.Router();

// All user routes require authentication
router.use(authenticateToken);

// Profile routes
router.get("/profile", userController.getProfile);
router.put(
  "/profile",
  validateRequest(updateProfileSchema),
  userController.updateProfile
);

// Address routes
router.get("/addresses", userController.getAddresses);
router.post(
  "/addresses",
  validateRequest(addAddressSchema),
  userController.addAddress
);
router.put(
  "/addresses/:addressId",
  validateRequest(addAddressSchema),
  userController.updateAddress
);
router.delete("/addresses/:addressId", userController.deleteAddress);

// Password and account management
router.put(
  "/change-password",
  validateRequest(
    Joi.object({
      currentPassword: Joi.string().required(),
      newPassword: Joi.string().min(6).required(),
    })
  ),
  userController.changePassword
);

router.put("/deactivate", userController.deactivateAccount);

module.exports = router;
