const User = require("../models/User");
const { generateTokens } = require("../config/jwt");
const emailService = require("../services/emailService");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const authController = {
  // Register new user
  register: async (req, res) => {
    try {
      const {
        firstName,
        lastName,
        email,
        password,
        phone,
        dateOfBirth,
        gender,
      } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email }, { phone }],
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message:
            existingUser.email === email
              ? "Email already registered"
              : "Phone number already registered",
        });
      }

      // Create email verification token
      const emailVerificationToken = crypto.randomBytes(32).toString("hex");

      // Create new user
      const user = new User({
        firstName,
        lastName,
        email,
        password,
        phone,
        dateOfBirth,
        gender,
        emailVerificationToken,
        emailVerificationExpires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      });

      await user.save();

      // Send verification email
      await emailService.sendVerificationEmail(
        user.email,
        emailVerificationToken
      );

      res.status(201).json({
        success: true,
        message:
          "User registered successfully. Please check your email for verification.",
        data: {
          userId: user._id,
          email: user.email,
          isEmailVerified: user.isEmailVerified,
        },
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Login user
  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      // Find user and include password
      const user = await User.findOne({ email }).select("+password");

      if (!user) {
        return res.status(401).json({
          // Unauthorized
          success: false,
          message: "Invalid email or password",
        });
      }

      // Check if account is locked
      if (user.isLocked) {
        return res.status(423).json({
          success: false,
          message: "Account temporarily locked due to too many login attempts",
        }); //Locked
      }

      // Check id account is active
      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: "Account is deactivated",
        });
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);

      if (!isPasswordValid) {
        await user.incLoginAttempts();
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
      }

      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(user._id);

      // Save refresh token
      user.refreshTokens.push(refreshToken);
      user.lastLogin = new Date();
      user.loginAttempts = 0; // Reset login attempts
      user.lockUntil = undefined;
      await user.save();

      res.json({
        success: true,
        message: "Login Successfull",
        data: {
          user: {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            isEmailVerified: user.isEmailVerified,
            role: user.role,
          },
          accessToken,
          refreshToken,
        },
      });
    } catch (error) {
      console.error("Login error", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },
  //Refresh access token

  refreshToken: async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          message: "Refresh token required",
        });
      }

      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

      if (decoded.type !== "refresh") {
        return res.status(401).json({
          success: false,
          message: "Invalid token type",
        });
      }

      const user = await User.findById(decoded.userId);

      if (!user || !user.refreshTokens.includes(refreshToken)) {
        return res.status(401).json({
          success: false,
          message: "Invalid refresh token",
        });
      }

      // Generate new tokens
      const tokens = generateTokens(user._id);

      // Replace old refresh token with new one
      user.refreshTokens = user.refreshTokens.filter(
        (token) => token !== refreshToken
      );
      user.refreshTokens.push(tokens.refreshToken);
      await user.save();

      res.json({
        success: true,
        data: tokens,
      });
    } catch (error) {
      console.error("Refresh token error", error);
      res.status(401).json({
        success: false,
        message: "Invalid refersh token",
      });
    }
  },

  // Logout user

  logout: async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: "Refresh token required",
        });
      }

      const user = await User.findById(req.user._id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      user.refreshTokens = user.refreshTokens.filter(
        (token) => token !== refreshToken
      );
      await user.save();

      res.json({
        success: true,
        message: "Logout successful",
      });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Verify email
  verifyEmail: async (req, res) => {
    try {
      const { token } = req.params;

      const user = await User.findOne({
        emailVerificationToken: token,
        emailVerificationExpires: { $gt: Date.now() },
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired verfication token",
        });
      }

      user.isEmailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      await user.save();

      res.json({
        success: true,
        message: "Email verified successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Forgot password
  forgotPassword: async (req, res) => {
    try {
      const { email } = req.body;

      const user = await User.findOne({ email });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString("hex");

      user.passwordResetToken = resetToken;
      user.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
      await user.save();

      // Send reset email
      await emailService.sendPasswordResetEmail(user.email, resetToken);

      res.json({
        success: true,
        message: "Password reset email sent",
      });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Reset password when user click the link in email 
  resetPassword: async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      const user = await User.findOne({
        passwordResetToken: token,
        passwordResetExpires: { $gt: Date.now() },
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: "Invalid or expired reset token",
        });
      }

      user.password = newPassword;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      user.refreshTokens = []; // Invalidate all refresh tokens
      await user.save();

      res.json({
        success: true,
        message: "Password reset successful",
      });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  },

  // Token verfication for gateway
  verifyToken: async (req, res) => {
    try {
      // Token is already verified by the auth middleware
      // req.user contain the decoded user data 

      res.json({
        success: true,
        message: 'Token is valid',
        user: {
          userId: req.user.userId,
          email: req.user.email,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
        role: req.user.role || 'user'

        }
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Token verification failed",
        error: error.message
      })
    }
  }
};

module.exports = authController;
