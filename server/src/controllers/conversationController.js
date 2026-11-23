import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import DirectMessage from "../models/DirectMessage.js";
import { createNotification } from "../services/notificationService.js";
import { getIO } from "../sockets/socket.js";

import {
  createOrGetConversation,
  getAccessibleConversation,
} from "../services/conversationService.js";

import { validateAttachments } from "../utils/fileValidation.js";

// START OR GET CONVERSATION
export const startConversation = async (req, res) => {
  try {
    const { recipientId } = req.body;

    const conversation = await createOrGetConversation(
      req.user._id,
      recipientId,
    );

    return res.status(200).json({
      success: true,
      conversation,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Could not start conversation",
    });
  }
};

// GET MY CONVERSATIONS
export const getMyConversations = async (req, res, next) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
    })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .populate(
        "participants",
        "name email avatar lastSeen customStatusText customStatusEmoji customStatusExpiresAt",
      )
      .populate({
        path: "lastMessage",
        select: "content sender createdAt deletedAt attachments",
        populate: {
          path: "sender",
          select: "name avatar",
        },
      });

    const results = await Promise.all(
      conversations.map(async (conversation) => {
        const data = conversation.toObject();

        const otherParticipant = data.participants.find(
          (participant) =>
            String(participant._id) !== String(req.user._id),
        );

        const myReadState = data.readStates.find(
          (state) => String(state.user) === String(req.user._id),
        );

        const unreadFilter = {
          conversation: conversation._id,
          sender: { $ne: req.user._id },
          deletedAt: null,
        };

        if (myReadState?.lastReadAt) {
          unreadFilter.createdAt = {
            $gt: myReadState.lastReadAt,
          };
        }

        const unreadCount = await DirectMessage.countDocuments(unreadFilter);

        return {
          ...data,
          otherParticipant,
          unreadCount,
        };
      }),
    );

    return res.status(200).json({
      success: true,
      count: results.length,
      conversations: results,
    });
  } catch (error) {
    next(error);
  }
};

// GET ONE CONVERSATION
export const getConversation = async (req, res, next) => {
  try {
    const conversation = await getAccessibleConversation(
      req.params.conversationId,
      req.user._id,
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    await conversation.populate(
      "participants",
      "name email avatar lastSeen customStatusText customStatusEmoji customStatusExpiresAt",
    );

    await conversation.populate({
      path: "lastMessage",
      populate: {
        path: "sender",
        select: "name avatar",
      },
    });

    return res.status(200).json({
      success: true,
      conversation,
    });
  } catch (error) {
    next(error);
  }
};

// GET DIRECT MESSAGE HISTORY
export const getDirectMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { before, limit = 30 } = req.query;

    const conversation = await getAccessibleConversation(
      conversationId,
      req.user._id,
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found or access denied",
      });
    }

    const pageLimit = Math.min(
      Math.max(parseInt(limit, 10) || 30, 1),
      50,
    );

    const query = {
      conversation: conversationId,
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

    const messages = await DirectMessage.find(query)
      .sort({ _id: -1 })
      .limit(pageLimit + 1)
      .populate("sender", "name email avatar")
      .populate({
        path: "replyTo",
        select: "content sender createdAt deletedAt",
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
      nextCursor: hasMore ? messages[0]?._id : null,
      messages,
    });
  } catch (error) {
    next(error);
  }
};

// SEND DIRECT MESSAGE
export const sendDirectMessage = async (req, res, next) => {
  try {
    const { conversationId } = req.params;

    const {
      content = "",
      replyTo = null,
      attachments = [],
    } = req.body;

    const conversation = await getAccessibleConversation(
      conversationId,
      req.user._id,
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found or access denied",
      });
    }

    if (typeof content !== "string" || content.length > 5000) {
      return res.status(400).json({
        success: false,
        message: "Message cannot exceed 5000 characters",
      });
    }

    // Validate attachment metadata before saving.
    let validAttachments;

    try {
      validAttachments = validateAttachments(attachments);
    } catch (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError.message,
      });
    }

    if (!content.trim() && validAttachments.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Message cannot be empty",
      });
    }

    // Validate reply target.
    if (replyTo) {
      if (!mongoose.Types.ObjectId.isValid(replyTo)) {
        return res.status(400).json({
          success: false,
          message: "Invalid reply message",
        });
      }

      const originalMessage = await DirectMessage.findOne({
        _id: replyTo,
        conversation: conversationId,
        deletedAt: null,
      });

      if (!originalMessage) {
        return res.status(400).json({
          success: false,
          message: "Reply message not found",
        });
      }
    }

    // Create message using validated attachments.
    const message = await DirectMessage.create({
      conversation: conversationId,
      sender: req.user._id,
      content: content.trim(),
      replyTo,
      attachments: validAttachments,
    });

    conversation.lastMessage = message._id;
    conversation.lastMessageAt = message.createdAt;

    const senderReadState = conversation.readStates.find(
      (state) => String(state.user) === String(req.user._id),
    );

    if (senderReadState) {
      senderReadState.lastReadAt = new Date();
    } else {
      conversation.readStates.push({
        user: req.user._id,
        lastReadAt: new Date(),
      });
    }

    await conversation.save();

    await message.populate("sender", "name email avatar");

    await message.populate({
      path: "replyTo",
      select: "content sender createdAt",
      populate: {
        path: "sender",
        select: "name avatar",
      },
    });

    const recipientId = conversation.participants.find(
      (participant) =>
        String(participant) !== String(req.user._id),
    );

    // Create notification.
    if (recipientId) {
      try {
        await createNotification({
          recipient: recipientId,
          sender: req.user._id,
          type: replyTo
            ? "direct_message_reply"
            : "direct_message",
          directMessage: message._id,
          conversation: conversation._id,
          content: content.trim() || "Sent an attachment",
        });
      } catch (notificationError) {
        console.error(
          "DM notification error:",
          notificationError.message,
        );
      }
    }

    return res.status(201).json({
      success: true,
      message: "Direct message sent successfully",
      data: message,
    });
  } catch (error) {
    next(error);
  }
};

// EDIT DIRECT MESSAGE
export const editDirectMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;

    if (
      typeof content !== "string" ||
      !content.trim() ||
      content.length > 5000
    ) {
      return res.status(400).json({
        success: false,
        message: "Message must contain 1 to 5000 characters",
      });
    }

    const message = await DirectMessage.findById(messageId);

    if (!message || message.deletedAt) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    const conversation = await getAccessibleConversation(
      message.conversation,
      req.user._id,
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found or access denied",
      });
    }

    if (String(message.sender) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "You can only edit your own messages",
      });
    }

    message.content = content.trim();
    message.editedAt = new Date();

    await message.save();
    await message.populate("sender", "name email avatar");

    return res.status(200).json({
      success: true,
      message: "Direct message updated successfully",
      data: message,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE DIRECT MESSAGE
export const deleteDirectMessage = async (req, res, next) => {
  try {
    const message = await DirectMessage.findById(req.params.messageId);

    if (!message || message.deletedAt) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    const conversation = await getAccessibleConversation(
      message.conversation,
      req.user._id,
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found or access denied",
      });
    }

    if (String(message.sender) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own messages",
      });
    }

    message.deletedAt = new Date();
    message.content = "This message was deleted";

    await message.save();

    if (String(conversation.lastMessage) === String(message._id)) {
      const latestMessage = await DirectMessage.findOne({
        conversation: conversation._id,
        deletedAt: null,
      }).sort({ _id: -1 });

      conversation.lastMessage = latestMessage?._id || null;

      conversation.lastMessageAt =
        latestMessage?.createdAt || conversation.createdAt;

      await conversation.save();
    }

    return res.status(200).json({
      success: true,
      message: "Direct message deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// MARK CONVERSATION AS READ
export const markConversationRead = async (req, res, next) => {
  try {
    const conversation = await getAccessibleConversation(
      req.params.conversationId,
      req.user._id,
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found or access denied",
      });
    }

    const now = new Date();

    const readState = conversation.readStates.find(
      (state) => String(state.user) === String(req.user._id),
    );

    if (readState) {
      readState.lastReadAt = now;
    } else {
      conversation.readStates.push({
        user: req.user._id,
        lastReadAt: now,
      });
    }

    await conversation.save();

    return res.status(200).json({
      success: true,
      message: "Conversation marked as read",
      lastReadAt: now,
    });
  } catch (error) {
    next(error);
  }
};

// TOGGLE DIRECT MESSAGE REACTION
export const toggleDirectMessageReaction = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;

    const ALLOWED_EMOJIS = [
      "\u{1F44D}",
      "\u2764\uFE0F",
      "\u{1F602}",
      "\u{1F389}",
      "\u{1F440}",
      "\u{1F680}",
    ];

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

    const message = await DirectMessage.findById(messageId);

    if (!message || message.deletedAt) {
      return res.status(404).json({
        success: false,
        message: "Direct message not found",
      });
    }

    const conversation = await getAccessibleConversation(
      message.conversation,
      req.user._id,
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found or access denied",
      });
    }

    const existingIndex = message.reactions.findIndex(
      (reaction) =>
        String(reaction.user) === String(req.user._id) &&
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
      user: String(reaction.user),
      emoji: reaction.emoji,
    }));

    const payload = {
      messageId: String(message._id),
      conversationId: String(message.conversation),
      reactions,
    };

    getIO()
      .to(`conversation:${message.conversation}`)
      .emit("dm:message:reactions", payload);

    return res.status(200).json({
      success: true,
      message: `Reaction ${action} successfully`,
      reactions,
    });
  } catch (error) {
    next(error);
  }
};

