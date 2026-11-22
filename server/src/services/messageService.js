import mongoose from "mongoose";
import Message from "../models/Message.js";
import { getAccessibleChannel } from "./channelAccess.js";
import Workspace from "../models/Workspace.js";
import { createNotification } from "./notificationService.js";

export const createMessage = async ({
  channelId,
  senderId,
  content,
  replyTo = null,
  mentionIds = [],
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

  const workspace = await Workspace.findById(channel.workspace);

  if (!workspace) {
    throw new Error("Workspace not found");
  }

  // Only accept unique IDs belonging to this workspace.
  const workspaceMemberIds = new Set(
    workspace.members.map((member) => member.userId.toString()),
  );

  const validMentionIds = [
    ...new Set(
      (Array.isArray(mentionIds) ? mentionIds : [])
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => id.toString())
        .filter(
          (id) =>
            id !== senderId.toString() &&
            workspaceMemberIds.has(id),
        ),
    ),
  ];

  // Private channels can only mention their own members.
  const channelMemberIds =
    channel.type === "private"
      ? new Set(channel.members.map((id) => id.toString()))
      : null;

  const allowedMentionIds = validMentionIds.filter(
    (id) => !channelMemberIds || channelMemberIds.has(id),
  );

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

  const recipientIds =
    channel.type === "private"
      ? channel.members
      : workspace.members.map((member) => member.userId);

  const mentionedSet = new Set(allowedMentionIds);
  const notificationType = replyTo ? "reply" : "new_message";

  // Mentioned users receive a mention notification instead of
  // a regular message notification.
  const notificationJobs = recipientIds
    .filter((recipientId) => {
      const id = recipientId.toString();

      return (
        id !== senderId.toString() &&
        (!channelMemberIds || channelMemberIds.has(id))
      );
    })
    .map((recipientId) => {
      const id = recipientId.toString();

      return createNotification({
        recipient: recipientId,
        sender: senderId,
        type: mentionedSet.has(id) ? "mention" : notificationType,
        message: message._id,
        channel: channel._id,
        content: content.trim(),
      });
    });

  // Notification failures should not make an already-saved message
  // appear to have failed.
  const notificationResults = await Promise.allSettled(notificationJobs);

  notificationResults.forEach((result) => {
    if (result.status === "rejected") {
      console.error("Message notification error:", result.reason?.message);
    }
  });

  return populatedMessage;
};