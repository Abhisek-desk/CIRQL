import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { getIO } from "../sockets/socket.js";

const isNotificationEnabled = (type, preferences = {}) => {
  switch (type) {
    case "direct_message":
      return preferences.directMessages !== false;

    case "direct_message_reply":
    case "reply":
      return preferences.replies !== false;

    case "mention":
      return preferences.mentions !== false;

    case "new_message":
      return preferences.channelMessages !== false;

    case "workspace_invitation":
      return true;

    default:
      return true;
  }
};

export const createNotification = async ({
  recipient,
  sender,
  type,
  message,
  channel,
  directMessage,
  conversation,
  content,
}) => {
  if (String(recipient) === String(sender)) {
    return null;
  }

  // Respect the recipient's notification preferences.
  const recipientUser = await User.findById(recipient)
    .select("notificationPreferences");

  if (!recipientUser) {
    return null;
  }

  if (
    !isNotificationEnabled(
      type,
      recipientUser.notificationPreferences
    )
  ) {
    return null;
  }

  // Prevent duplicate notifications for the same direct message.
  if (directMessage) {
    const existingNotification = await Notification.findOne({
      recipient,
      directMessage,
      type: { $in: ["direct_message", "direct_message_reply"] },
    }).select("_id");

    if (existingNotification) {
      return existingNotification;
    }
  }

  // Suppress DM notifications when the recipient is viewing the conversation.
  if (directMessage && conversation) {
    try {
      const io = getIO();
      const recipientSockets = await io
        .in(`user:${String(recipient)}`)
        .fetchSockets();

      const conversationRoom = `conversation:${String(conversation)}`;

      const isViewingConversation = recipientSockets.some((socket) =>
        socket.rooms.has(conversationRoom)
      );

      if (isViewingConversation) {
        return null;
      }
    } catch (error) {
      console.error(
        "Could not check active DM viewers:",
        error.message
      );
    }
  }

  const notification = await Notification.create({
    recipient,
    sender,
    type,
    message: message || null,
    channel: channel || null,
    directMessage: directMessage || null,
    conversation: conversation || null,
    content: content?.slice(0, 200) || "",
  });

  try {
    const populatedNotification = await Notification.findById(
      notification._id
    )
      .populate("sender", "name avatar")
      .populate("channel", "name workspace")
      .populate("conversation", "participants");

    getIO()
      .to(`user:${String(recipient)}`)
      .emit("notification:new", populatedNotification);
  } catch (error) {
    console.error(
      "Notification socket emission failed:",
      error.message
    );
  }

  return notification;
};
