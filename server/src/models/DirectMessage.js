import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      maxlength: 255,
    },
    format: {
      type: String,
      default: "",
    },
    size: {
      type: Number,
      required: true,
    },
    resourceType: {
      type: String,
      enum: ["image", "raw", "video"],
      default: "raw",
    },
    mimeType: {
      type: String,
      default: "",
    },
  },
  { _id: true }
);

const directMessageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    content: {
      type: String,
      default: "",
      trim: true,
      maxlength: 5000,
    },

    attachments: {
      type: [attachmentSchema],
      default: [],
      validate: {
        validator: (attachments) => attachments.length <= 5,
        message: "A message can contain at most 5 attachments",
      },
    },

    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DirectMessage",
      default: null,
    },

    editedAt: {
      type: Date,
      default: null,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    reactions: {
      type: [
        {
          user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
          },
          emoji: {
            type: String,
            required: true,
            enum: [
              "\u{1F44D}",
              "\u2764\uFE0F",
              "\u{1F602}",
              "\u{1F389}",
              "\u{1F440}",
              "\u{1F680}",
            ],
          },
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

directMessageSchema.index({ conversation: 1, _id: -1 });
directMessageSchema.index({ sender: 1, createdAt: -1 });

const DirectMessage = mongoose.model(
  "DirectMessage",
  directMessageSchema
);

export default DirectMessage;