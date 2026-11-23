import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import User from "../models/User.js";

export const getParticipantKey = (firstId, secondId) =>
  [String(firstId), String(secondId)].sort().join(":");

export const getAccessibleConversation = async (
  conversationId,
  userId
) => {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    return null;
  }

  return Conversation.findOne({
    _id: conversationId,
    participants: userId,
  });
};

export const createOrGetConversation = async (userId, recipientId) => {
  if (!mongoose.Types.ObjectId.isValid(recipientId)) {
    throw new Error("Invalid recipient ID");
  }

  if (String(userId) === String(recipientId)) {
    throw new Error("You cannot start a conversation with yourself");
  }

  const recipient = await User.findOne({
    _id: recipientId,
    isActive: true,
  }).select("_id");

  if (!recipient) {
    throw new Error("User not found or inactive");
  }

  const participantKey = getParticipantKey(userId, recipientId);

  const participants = [userId, recipient._id];

  let conversation = await Conversation.findOne({ participantKey });

  if (!conversation) {
    try {
      conversation = await Conversation.create({
        participants,
        participantKey,
        readStates: [
          { user: userId, lastReadAt: new Date() },
          { user: recipientId, lastReadAt: null },
        ],
      });
    } catch (error) {
      // Handle two users starting the same conversation simultaneously.
      if (error.code !== 11000) {
        throw error;
      }

      conversation = await Conversation.findOne({ participantKey });

      if (!conversation) {
        throw error;
      }
    }
  }

  return Conversation.findById(conversation._id)
    .populate("participants", "name email avatar lastSeen customStatusText customStatusEmoji customStatusExpiresAt")
    .populate({
      path: "lastMessage",
      populate: {
        path: "sender",
        select: "name avatar",
      },
    });
};