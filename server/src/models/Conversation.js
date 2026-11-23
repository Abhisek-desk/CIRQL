import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    participants: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
      ],
      required: true,
      validate: {
        validator: (participants) =>
          participants.length === 2 &&
          new Set(participants.map(String)).size === 2,
        message: "A direct conversation must have exactly two unique participants",
      },
    },

    participantKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DirectMessage",
      default: null,
    },

    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    readStates: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        lastReadAt: {
          type: Date,
          default: null,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

conversationSchema.index({ participants: 1, lastMessageAt: -1 });

const Conversation = mongoose.model(
  "Conversation",
  conversationSchema
);

export default Conversation;