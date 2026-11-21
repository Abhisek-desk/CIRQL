import mongoose from "mongoose";
import Message from "../models/Message.js";
import { getAccessibleChannel } from "../services/channelAccess.js";

const ALLOWED_EMOJIS = ["👍", "❤️", "😂", "🎉", "👀", "🚀"];

export const toggleReaction = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;

    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid message ID",
      });
    }

    if (!ALLOWED_EMOJIS.includes(emoji)) {
      return res.status(400).json({
        success: false,
        message: "Unsupported emoji",
      });
    }

    const message = await Message.findById(messageId);

    if (!message || message.deletedAt) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

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

    const existingIndex = message.reactions.findIndex(
      (reaction) =>
        reaction.user.toString() === req.user._id.toString() &&
        reaction.emoji === emoji
    );

    if (existingIndex >= 0) {
      message.reactions.splice(existingIndex, 1);
    } else {
      message.reactions.push({
        user: req.user._id,
        emoji,
      });
    }

    await message.save();

    return res.status(200).json({
      success: true,
      message: existingIndex >= 0
        ? "Reaction removed"
        : "Reaction added",
      reactions: message.reactions,
    });
  } catch (error) {
    next(error);
  }
};