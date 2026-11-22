import mongoose from "mongoose";
import Message from "../models/Message.js";
import { getAccessibleChannel } from "./channelAccess.js";
import Workspace from "../models/Workspace.js";
import { createNotification } from "./notificationService.js";

export const createMessage = async ({
  channelId,
  senderId,
  content = "",
  replyTo = null,
  mentionIds = [],
  attachments = [],
}) => {
  const { channel } =
    (await getAccessibleChannel(channelId, senderId)) || {};

  if (!channel) {
    throw new Error("Channel not found or access denied");
  }

  const messageContent = typeof content === "string" ? content.trim() : "";

  if (messageContent.length > 5000) {
    throw new Error("Message cannot exceed 5000 characters");
  }

  if (!messageContent && (!Array.isArray(attachments) || !attachments.length)) {
    throw new Error("Message must contain text or an attachment");
  }

  if (!Array.isArray(attachments) || attachments.length > 5) {
    throw new Error("A message can contain at most 5 attachments");
  }

  const validAttachments = attachments.map((file) => {
    if (
      !file ||
      typeof file.url !== "string" ||
      typeof file.publicId !== "string" ||
      typeof file.name !== "string" ||
      !Number.isFinite(file.size) ||
      file.size <= 0
    ) {
      throw new Error("Invalid attachment data");
    }

    return {
      url: file.url,
      publicId: file.publicId,
      name: file.name.slice(0, 255),
      format: file.format || "",
      size: file.size,
      resourceType: file.resourceType || "raw",
      mimeType: file.mimeType || "",
    };
  });

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

  const workspaceMemberIds = new Set(
    workspace.members.map((member) => member.userId.toString())
  );

  const validMentionIds = [
    ...new Set(
      (Array.isArray(mentionIds) ? mentionIds : [])
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => id.toString())
        .filter(
          (id) =>
            id !== senderId.toString() &&
            workspaceMemberIds.has(id)
        )
    ),
  ];

  const channelMemberIds =
    channel.type === "private"
      ? new Set(channel.members.map((id) => id.toString()))
      : null;

  const allowedMentionIds = validMentionIds.filter(
    (id) => !channelMemberIds || channelMemberIds.has(id)
  );

  const message = await Message.create({
    channel: channel._id,
    sender: senderId,
    content: messageContent,
    replyTo,
    attachments: validAttachments,
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
        content: messageContent || "Sent an attachment",
      });
    });

  const notificationResults = await Promise.allSettled(notificationJobs);

  notificationResults.forEach((result) => {
    if (result.status === "rejected") {
      console.error("Message notification error:", result.reason?.message);
    }
  });

  return populatedMessage;
};
