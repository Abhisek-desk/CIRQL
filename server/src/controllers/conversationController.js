import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import DirectMessage from "../models/DirectMessage.js";
import User from "../models/User.js";

import {
  createOrGetConversation,
  getAccessibleConversation,
  getParticipantKey,
} from "../services/conversationService.js";

export const startConversation = async (req, res, next) => {
  try {
    const { recipientId } = req.body;

    const conversation = await createOrGetConversation(
      req.user._id,
      recipientId
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

export const getMyConversations = async (req, res, next) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
    })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .populate(
        "participants",
        "name email avatar lastSeen customStatusText customStatusEmoji customStatusExpiresAt"
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
            String(participant._id) !== String(req.user._id)
        );

        const myReadState = data.readStates.find(
          (state) => String(state.user) === String(req.user._id)
        );

        const unreadCount = myReadState?.lastReadAt
          ? await DirectMessage.countDocuments({
              conversation: conversation._id,
              sender: { $ne: req.user._id },
              createdAt: { $gt: myReadState.lastReadAt },
              deletedAt: null,
            })
          : await DirectMessage.countDocuments({
              conversation: conversation._id,
              sender: { $ne: req.user._id },
              deletedAt: null,
            });

        return {
          ...data,
          otherParticipant,
          unreadCount,
        };
      })
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

export const getConversation = async (req, res, next) => {
  try {
    const conversation = await getAccessibleConversation(
      req.params.conversationId,
      req.user._id
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    await conversation.populate(
      "participants",
      "name email avatar lastSeen customStatusText customStatusEmoji customStatusExpiresAt"
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