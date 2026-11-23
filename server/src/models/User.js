import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    passwordHash: {
      type: String,
      required: true,
      select: false,
    },

    avatar: {
      type: String,
      default: "",
    },

    lastSeen: {
      type: Date,
      default: null,
    },

    customStatusText: {
      type: String,
      default: "",
      maxlength: 80,
      trim: true,
    },

    customStatusEmoji: {
      type: String,
      default: "",
      maxlength: 12,
    },

    customStatusExpiresAt: {
      type: Date,
      default: null,
    },
    notificationPreferences: {
      directMessages: { type: Boolean, default: true },
      replies: { type: Boolean, default: true },
      mentions: { type: Boolean, default: true },
      channelMessages: { type: Boolean, default: true },
      sound: { type: Boolean, default: true },
    },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    refreshTokenHash: {
      type: String,
      default: null,
      select: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", userSchema);

export default User;
