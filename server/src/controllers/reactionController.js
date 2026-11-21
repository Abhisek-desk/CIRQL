import mongoose from "mongoose";
import Message from "../models/Message.js";
import { getAccessibleChannel } from "../services/channelAccess.js";

const ALLOWED_EMOJIS = ["👍", "❤️", "😂", "🎉", "👀", "🚀"];

export const toggleReaction = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;

    // Validate message ID
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid message ID",
      });
    }

    // Validate emoji
    if (!ALLOWED_EMOJIS.includes(emoji)) {
      return res.status(400).json({
        success: false,
        message: "Unsupported emoji",
      });
    }

    // Find message
    const message = await Message.findById(messageId);

    if (!message || message.deletedAt) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    // Check channel access
    const access = await getAccessibleChannel(
      message.channel,
      req.user._id
    );

    if (!access) {
      return res.status(404).json({
        success: false,
        message: "Channel not found or access denied",
      });
    }

    // Ensure reactions array exists for older messages
    if (!Array.isArray(message.reactions)) {
      message.reactions = [];
    }

    // Find existing reaction from this user
    const existingIndex = message.reactions.findIndex(
      (reaction) =>
        reaction.user.toString() === req.user._id.toString() &&
        reaction.emoji === emoji
    );

    let action;

    if (existingIndex !== -1) {
      // Remove reaction if already added
      message.reactions.splice(existingIndex, 1);
      action = "removed";
    } else {
      // Add new reaction
      message.reactions.push({
        user: req.user._id,
        emoji,
      });
      action = "added";
    }

    await message.save();

    return res.status(200).json({
      success: true,
      message: `Reaction ${action} successfully`,
      reactions: message.reactions,
    });
  } catch (error) {
    next(error);
  }
};