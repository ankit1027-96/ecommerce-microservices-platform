const User = require("../models/User");

const userController = {
  // Get user profile
  getProfile: async (req, res) => {
    try {
      const user = await User.findById(req.user._id).select("-refreshTokens");

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      console.error("Get profile error", error);
      res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },

  // Update user profile
  updateProfile: async (req, res) => {
    try {
      const updates = req.body;
      const user = await User.findByIdAndUpdate(req.user._id, updates, {
        new: true,
        runValidators: true,
      }).select("-refreshTokens");

      res.json({
        success: true,
        message: "Profile updated successfully",
        data: user,
      });
    } catch (error) {
      console.error("Update profile error", error);
      res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  },

  // Get user address
  getAddresses: async (req, res) => {
    try {
      const user = await User.findById(req.user._id).select("addresses");

      res.json({
        success: true,
        message: user.addresses,
      });
    } catch (error) {
      console.error("Get addresses error", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Add new address
  addAddress: async (req, res) => {
    try {
      const user = await User.findById(req.user._id);

      // If this is set as default, unset others
      if (req.body.isDefault) {
        user.addresses.forEach((address) => {
          address.isDefault = false;
        });
      }

      user.addresses.push(req.body);
      await user.save();

      res.status(201).json({
        success: true,
        message: "Address added successfully",
      });
    } catch (error) {
      console.error("Add address error", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Update address
  updateAddress: async (req, res) => {
    try {
      const { addressId } = req.params;
      const user = await User.findById(req.user._id);
      const address = user.addresses.id(addressId);

      if (!address) {
        return res.status(404).json({
          success: false,
          message: "Address not found",
        });
      }
      // If this address is set to default have to unset others
      if (req.body.isDefault) {
        user.addresses.forEach((addr) => {
          if (addr._id.toString() !== addressId) {
            addr.isDefault = false;
          }
        });
      }
      Object.assign(address, req.body);
      await user.save();

      res.json({
        success: true,
        message: "Address updated successfully",
        data: address,
      });
    } catch (error) {
      console.error("Update address error", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Delete address
  deleteAddress: async (req, res) => {
    try {
      const { addressId } = req.params;
      const user = await User.findById(req.user._id);

      const address = user.addresses.id(addressId);
      if (!address) {
        return res.status(404).json({
          success: false,
          message: "Address not found",
        });
      }
      address.deleteOne();
      await user.save();

      res.json({
        success: true,
        message: "Address deleted successfully",
      });
    } catch (error) {
      console.error("Delete address error", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Change password
  changePassword: async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      const user = await User.findById(req.user._id).select('+password');
      
      // Verify current password
      const isCurrentPasswordValid = await user.comparePassword(currentPassword);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }
      
      // Update password
      user.password = newPassword;
      user.refreshTokens = []; // Invalidate all refresh tokens
      await user.save();
      
      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Deactivate account
  deactivateAccount: async (req, res) => {
    try {
      const user = await User.findById(req.user._id);
      user.isActive = false;
      user.refreshTokens = []; // invalidate all refersh tokens
      await user.save();

      res.json({
        success: true,
        message: "Account deactivated successfully",
      });
    } catch (error) {
      console.error("Deactivate account error", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
};

module.exports = userController;
