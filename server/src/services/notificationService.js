import Notification from "../models/Notification.js";
import { getIO } from "../sockets/socket.js";

export const createNotification = async ({
  recipient,
  sender,
  type,
  message,
  channel,
  content,
}) => {
  if (recipient.toString() === sender.toString()) {
    return null;
  }

  const notification = await Notification.create({
    recipient,
    sender,
    type,
    message,
    channel,
    content: content?.slice(0, 200) || "",
  });

  // Notify all active sockets belonging to the recipient.
  try {
    const populatedNotification = await Notification.findById(
      notification._id,
    )
      .populate("sender", "name avatar")
      .populate("channel", "name workspace");

    getIO()
      .to(`user:${recipient.toString()}`)
      .emit("notification:new", populatedNotification);
  } catch (error) {
    // A socket failure must not invalidate a saved notification.
    console.error("Notification socket emission failed:", error.message);
  }

  return notification;
};