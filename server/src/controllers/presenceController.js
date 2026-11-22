import User from "../models/User.js";
import { getIO } from "../sockets/socket.js";

const MAX_STATUS_LENGTH = 80;

export const updateCustomStatus = async (req, res, next) => {
  try {
    const { text = "", emoji = "", expiresAt = null } = req.body;

    if (
      typeof text !== "string" ||
      typeof emoji !== "string" ||
      text.length > MAX_STATUS_LENGTH ||
      emoji.length > 12
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid custom status",
      });
    }

    let expiration = null;

    if (expiresAt !== null) {
      expiration = new Date(expiresAt);

      if (
        Number.isNaN(expiration.getTime()) ||
        expiration.getTime() <= Date.now()
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid status expiration time",
        });
      }
    }

    const status = {
      text: text.trim(),
      emoji: emoji.trim(),
      expiresAt: expiration,
    };

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          customStatusText: status.text,
          customStatusEmoji: status.emoji,
          customStatusExpiresAt: status.expiresAt,
        },
      },
      { new: true, runValidators: true }
    ).select("name avatar customStatusText customStatusEmoji customStatusExpiresAt lastSeen");

    const payload = {
      userId: user._id,
      name: user.name,
      avatar: user.avatar,
      customStatusText: user.customStatusText,
      customStatusEmoji: user.customStatusEmoji,
      customStatusExpiresAt: user.customStatusExpiresAt,
    };

    try {
      getIO().emit("presence:status", payload);
    } catch (socketError) {
      console.error("Presence status broadcast failed:", socketError.message);
    }

    return res.status(200).json({
      success: true,
      message: "Custom status updated",
      status: payload,
    });
  } catch (error) {
    next(error);
  }
};

export const clearCustomStatus = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          customStatusText: "",
          customStatusEmoji: "",
          customStatusExpiresAt: null,
        },
      },
      { new: true }
    ).select("name avatar customStatusText customStatusEmoji customStatusExpiresAt");

    const payload = {
      userId: user._id,
      name: user.name,
      avatar: user.avatar,
      customStatusText: "",
      customStatusEmoji: "",
      customStatusExpiresAt: null,
    };

    try {
      getIO().emit("presence:status", payload);
    } catch (socketError) {
      console.error("Presence status broadcast failed:", socketError.message);
    }

    return res.status(200).json({
      success: true,
      message: "Custom status cleared",
    });
  } catch (error) {
    next(error);
  }
};
