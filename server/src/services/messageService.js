import mongoose from "mongoose";
import Message from "../models/Message.js";
import { getAccessibleChannel } from "./channelAccess.js";
import Workspace from "../models/Workspace.js";
import Channel from "../models/Channel.js";
import { createNotification } from "./notificationService.js";

export const createMessage = async ({
  channelId,
  senderId,
  content,
  replyTo = null,
}) => {
  const { channel } = (await getAccessibleChannel(channelId, senderId)) || {};

  if (!channel) {
    throw new Error("Channel not found or access denied");
  }

  if (!content || !content.trim()) {
    throw new Error("Message content cannot be empty");
  }

  if (content.length > 5000) {
    throw new Error("Message cannot exceed 5000 characters");
  }

  if (replyTo) {
    if (!mongoose.Types.ObjectId.isValid(replyTo)) {
      throw new Error("Invalid reply message ID");
    }

    const parentMessage = await Message.findOne({
      _id: replyTo,
      channel: channel._id,
      deletedAt: null,
    });

    if (!parentMessage) {
      throw new Error("Reply message not found");
    }
  }

  const message = await Message.create({
    channel: channel._id,
    sender: senderId,
    content: content.trim(),
    replyTo,
  });

  const populatedMessage = await Message.findById(message._id)
    .populate("sender", "name email avatar")
    .populate({
      path: "replyTo",
      select: "content sender createdAt",
      populate: {
        path: "sender",
        select: "name avatar",
      },
    });

  const workspace = await Workspace.findById(channel.workspace);

  const recipientIds =
    channel.type === "private"
      ? channel.members
      : workspace.members.map((member) => member.userId);

  const notificationType = replyTo ? "reply" : "new_message";

  await Promise.all(
    recipientIds
      .filter((recipientId) => recipientId.toString() !== senderId.toString())
      .map((recipientId) =>
        createNotification({
          recipient: recipientId,
          sender: senderId,
          type: notificationType,
          message: message._id,
          channel: channel._id,
          content,
        }),
      ),
  );

  return populatedMessage;
};
