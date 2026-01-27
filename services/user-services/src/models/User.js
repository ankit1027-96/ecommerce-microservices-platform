const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { string } = require("joi");

const addressSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["home", "work", "other"],
    default: "home",
  },
  firstName: {
    type: String,
    required: true,
    trim: true,
    minlength: [2, "Firstname must be at least 2 characters"],
    maxlength: [50, "Firstname cannot exceed 50 characters"],
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
    minlength: [2, "Lastname must be at least 2 characters"],
    maxlength: [50, "Lastname cannot exceed 50 characters"],
  },
  phone: {
    type: String,
    required: true,
    match: [/^[6-9]\d{9}$/, "Please enter a valid 10-digit phone number"],
  },
  addressLine1: {
    type: String,
    required: true,
    maxlength: [100, "Address line 1 cannot exceed 100 characters"],
  },
  addressLine2: {
    type: String,
    maxlength: [100, "Address line 2 cannot exceed 100 characters"],
  },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zipCode: { type: String, required: true },
  country: { type: String, default: "India" },
  isDefault: { type: Boolean, default: false },
});

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      minLength: 2,
      maxLength: 50,
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      minLength: 2,
      maxLength: 50,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
        "Please enter a valid email address",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minLength: 6,
      select: false,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      match: [/^[6-9]\d{9}$/, "Please enter a valid 10-digit phone number"],
    },
    dateofBirth: {
      type: Date,
      validate: {
        validator: function (value) {
          if (!value) return true; // Optional field
          const age = (new Date() - value) / (1000 * 60 * 60 * 24 * 365.25);
          return age >= 13 && age <= 120; // Age between 13 and 120
        },
        message: "Age must be between 13 and 120 years",
      },
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
    },
    addresses: [addressSchema],
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    role: {
      type: String,
      enum: ["customer", "admin"],
      default: "customer",
    },

    // Email verfication
    emailVerificationToken: String,
    emailVerificationExpires: Date,

    // Password reset
    passwordResetToken: String,
    passwordResetExpires: Date,

    // JWT refresh token
    refreshTokens: [String],
    lockUntil: Date,
    // Profile completion tracking
    profileCompletionPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
  },

  { timestamps: true }
);

// Index for fast lookups
// userSchema.index({ email: 1 });
// userSchema.index({ phone: 1 });

userSchema.virtual("isLocked").get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Middleware to hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to check password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to increment login attempts
userSchema.methods.incLoginAttempts = function () {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 },
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };

  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 };
  }

  return this.updateOne(updates);
};
module.exports = mongoose.model("User", userSchema);
