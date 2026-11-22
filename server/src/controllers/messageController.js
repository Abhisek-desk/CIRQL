import mongoose from "mongoose";
import Message from "../models/Message.js";
import { createMessage } from "../services/messageService.js";
import { getAccessibleChannel } from "../services/channelAccess.js";

// SEND MESSAGE
export const sendMessage = async (req, res, next) => {
  try {
    const message = await createMessage({
      channelId: req.params.channelId,
      senderId: req.user._id,
      content: req.body.content,
      replyTo: req.body.replyTo || null,
    });

    return res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: message,
    });
  } catch (error) {
    if (error.message.includes("access denied") ||
        error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (error.message.includes("cannot be empty") ||
        error.message.includes("exceed") ||
        error.message.includes("Invalid reply")) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    next(error);
  }
};

// SEARCH CHANNEL MESSAGES
export const searchMessages = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const {
      q,
      senderId,
      dateFilter = "all",
      date,
    } = req.query;

    const query = String(q || "").trim();

    if (!query || query.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Search query must contain 1 to 100 characters",
      });
    }

    const access = await getAccessibleChannel(
      channelId,
      req.user._id
    );

    if (!access) {
      return res.status(404).json({
        success: false,
        message: "Channel not found or access denied",
      });
    }

    const filters = {
      channel: channelId,
      deletedAt: null,
    };

    // SENDER FILTER
    if (senderId) {
      if (!mongoose.isValidObjectId(senderId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid sender ID",
        });
      }

      filters.sender = senderId;
    }

    // DATE FILTER
    const now = new Date();
    const todayStart = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate()
      )
    );

    if (dateFilter === "today") {
      filters.createdAt = {
        $gte: todayStart,
        $lt: new Date(todayStart.getTime() + 86400000),
      };
    } else if (dateFilter === "yesterday") {
      const yesterdayStart = new Date(
        todayStart.getTime() - 86400000
      );

      filters.createdAt = {
        $gte: yesterdayStart,
        $lt: todayStart,
      };
    } else if (dateFilter === "7days") {
      filters.createdAt = {
        $gte: new Date(todayStart.getTime() - 6 * 86400000),
        $lt: new Date(todayStart.getTime() + 86400000),
      };
    } else if (dateFilter === "custom") {
      if (
        typeof date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date)
      ) {
        return res.status(400).json({
          success: false,
          message: "A valid date in YYYY-MM-DD format is required",
        });
      }

      const customStart = new Date(`${date}T00:00:00.000Z`);

      if (
        Number.isNaN(customStart.getTime()) ||
        customStart.toISOString().slice(0, 10) !== date
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid custom date",
        });
      }

      filters.createdAt = {
        $gte: customStart,
        $lt: new Date(customStart.getTime() + 86400000),
      };
    } else if (dateFilter !== "all") {
      return res.status(400).json({
        success: false,
        message: "Invalid date filter",
      });
    }

    // ESCAPE REGEX INPUT
    const escapedQuery = query.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    filters.content = {
      $regex: escapedQuery,
      $options: "i",
    };

    const messages = await Message.find(filters)
      .sort({ createdAt: -1 })
      .limit(20)
      .populate("sender", "name avatar");

    return res.status(200).json({
      success: true,
      count: messages.length,
      messages,
    });
  } catch (error) {
    next(error);
  }
};
// GET CHANNEL MESSAGES
export const getMessages = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const { before, limit = 30 } = req.query;

    const access = await getAccessibleChannel(
      channelId,
      req.user._id
    );

    if (!access) {
      return res.status(404).json({
        success: false,
        message: "Channel not found or access denied",
      });
    }

    const pageLimit = Math.min(
      Math.max(parseInt(limit, 10) || 30, 1),
      50
    );

    const query = {
      channel: channelId,
      deletedAt: null,
    };

    if (before) {
      if (!mongoose.Types.ObjectId.isValid(before)) {
        return res.status(400).json({
          success: false,
          message: "Invalid pagination cursor",
        });
      }

      query._id = { $lt: before };
    }

    const messages = await Message.find(query)
      .sort({ _id: -1 })
      .limit(pageLimit + 1)
      .populate("sender", "name email avatar")
      .populate({
        path: "replyTo",
        select: "content sender createdAt",
        populate: {
          path: "sender",
          select: "name avatar",
        },
      });

    const hasMore = messages.length > pageLimit;

    if (hasMore) {
      messages.pop();
    }

    messages.reverse();

    return res.status(200).json({
      success: true,
      count: messages.length,
      hasMore,
      nextCursor: hasMore
        ? messages[0]?._id
        : null,
      messages,
    });
  } catch (error) {
    next(error);
  }
};

// EDIT MESSAGE
export const editMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message content cannot be empty",
      });
    }

    if (content.length > 5000) {
      return res.status(400).json({
        success: false,
        message: "Message cannot exceed 5000 characters",
      });
    }

    const message = await Message.findById(messageId);

    if (!message || message.deletedAt) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only edit your own messages",
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

    message.content = content.trim();
    message.editedAt = new Date();

    await message.save();

    await message.populate("sender", "name email avatar");

    return res.status(200).json({
      success: true,
      message: "Message updated successfully",
      data: message,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE MESSAGE
export const deleteMessage = async (req, res, next) => {
  try {
    const message = await Message.findById(
      req.params.messageId
    );

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

    const isSender =
      message.sender.toString() === req.user._id.toString();

    const isAdmin = ["owner", "admin"].includes(
      access.workspace.members.find(
        (member) =>
          member.userId.toString() === req.user._id.toString()
      )?.role
    );

    if (!isSender && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "You cannot delete this message",
      });
    }

    message.deletedAt = new Date();
    message.content = "This message was deleted";

    await message.save();

    return res.status(200).json({
      success: true,
      message: "Message deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

