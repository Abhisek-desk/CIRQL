import User from "../models/User.js";

const DEFAULT_PREFERENCES = {
  directMessages: true,
  replies: true,
  mentions: true,
  channelMessages: true,
  sound: true,
};

export const getNotificationPreferences = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select(
      "notificationPreferences"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      preferences: {
        ...DEFAULT_PREFERENCES,
        ...(user.notificationPreferences?.toObject?.() ||
          user.notificationPreferences ||
          {}),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateNotificationPreferences = async (req, res, next) => {
  try {
    const allowedKeys = Object.keys(DEFAULT_PREFERENCES);
    const updates = {};

    for (const key of allowedKeys) {
      if (typeof req.body[key] === "boolean") {
        updates[`notificationPreferences.${key}`] = req.body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one valid boolean preference",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select("notificationPreferences");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification preferences updated",
      preferences: {
        ...DEFAULT_PREFERENCES,
        ...(user.notificationPreferences?.toObject?.() ||
          user.notificationPreferences ||
          {}),
      },
    });
  } catch (error) {
    next(error);
  }
};
