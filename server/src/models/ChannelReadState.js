import mongoose from "mongoose";

const channelReadStateSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    channel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Channel",
      required: true,
    },
    lastReadAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

channelReadStateSchema.index(
  { user: 1, channel: 1 },
  { unique: true }
);

const ChannelReadState = mongoose.model(
  "ChannelReadState",
  channelReadStateSchema
);

export default ChannelReadState;
