import Notification from "../models/Notification.js";

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

  return Notification.create({
    recipient,
    sender,
    type,
    message,
    channel,
    content: content?.slice(0, 200) || "",
  });
};