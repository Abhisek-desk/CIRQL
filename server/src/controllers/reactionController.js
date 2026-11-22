import mongoose from "mongoose";
import Message from "../models/Message.js";
import { getAccessibleChannel } from "../services/channelAccess.js";
import { getIO } from "../sockets/socket.js";

const ALLOWED_EMOJIS = [
  "\u{1F44D}",       // 👍
  "\u2764\uFE0F",    // ❤️
  "\u{1F602}",       // 😂
  "\u{1F389}",       // 🎉
  "\u{1F440}",       // 👀
  "\u{1F680}",       // 🚀
];

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
      req.user._id,
    );

    if (!access) {
      return res.status(404).json({
        success: false,
        message: "Channel not found or access denied",
      });
    }

    if (!Array.isArray(message.reactions)) {
      message.reactions = [];
    }

    const existingIndex = message.reactions.findIndex(
      (reaction) =>
        reaction.user.toString() === req.user._id.toString() &&
        reaction.emoji === emoji,
    );

    const action = existingIndex !== -1 ? "removed" : "added";

    if (existingIndex !== -1) {
      message.reactions.splice(existingIndex, 1);
    } else {
      message.reactions.push({
        user: req.user._id,
        emoji,
      });
    }

    await message.save();

    const reactions = message.reactions.map((reaction) => ({
      user: reaction.user.toString(),
      emoji: reaction.emoji,
    }));

    const payload = {
      messageId: message._id.toString(),
      channelId: message.channel.toString(),
      reactions,
    };

    getIO()
      .to(`channel:${message.channel}`)
      .emit("message:reactions", payload);

    return res.status(200).json({
      success: true,
      message: `Reaction ${action} successfully`,
      reactions,
    });
  } catch (error) {
    next(error);
  }
};