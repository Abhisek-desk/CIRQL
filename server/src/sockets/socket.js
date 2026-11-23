import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

import { createMessage } from "../services/messageService.js";
import { getAccessibleChannel } from "../services/channelAccess.js";

import {
  addOnlineUser,
  removeOnlineUser,
  getOnlineUsers,
} from "../services/presenceService.js";

import Message from "../models/Message.js";
import DirectMessage from "../models/DirectMessage.js";
import Conversation from "../models/Conversation.js";
import { createNotification } from "../services/notificationService.js";

let io;

export const initializeSocketServer = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL,
      credentials: true,
    },
  });

  // SOCKET AUTHENTICATION
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new Error("Authentication required"));
      }

      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

      const user = await User.findById(decoded.sub);

      if (!user || !user.isActive) {
        return next(new Error("User not found or inactive"));
      }

      socket.user = user;

      next();
    } catch (error) {
      next(new Error("Invalid or expired access token"));
    }
  });

  // CONNECTION
  io.on("connection", (socket) => {
    const userId = socket.user._id.toString();

    // Private room for notifications sent to this user.
    socket.join(`user:${userId}`);

    console.log(`User connected: ${socket.user.name}`);

    // ONLINE PRESENCE
    addOnlineUser(userId, socket.id);

    // Send the current online users to the newly connected client.
    socket.emit("presence:sync", {
      onlineUsers: getOnlineUsers(),
    });

    io.emit("presence:online", {
      userId,
      onlineUsers: getOnlineUsers(),
    });

    // ================= DIRECT MESSAGES =================

    // JOIN DIRECT CONVERSATION
    socket.on("dm:join", async (conversationId, callback) => {
      try {
        const conversation = await Conversation.findOne({
          _id: conversationId,
          participants: socket.user._id,
        });

        if (!conversation) {
          return callback?.({
            success: false,
            message: "Conversation access denied",
          });
        }

        socket.join(`conversation:${conversationId}`);

        callback?.({
          success: true,
          message: "Joined direct conversation",
        });
      } catch (error) {
        callback?.({
          success: false,
          message: "Unable to join conversation",
        });
      }
    });

    // LEAVE DIRECT CONVERSATION
    socket.on("dm:leave", (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // SEND DIRECT MESSAGE
    socket.on("dm:send", async (payload, callback) => {
      try {
        const {
          conversationId,
          content = "",
          replyTo = null,
          attachments = [],
        } = payload || {};

        if (!conversationId) {
          return callback?.({
            success: false,
            message: "Conversation ID is required",
          });
        }

        const conversation = await Conversation.findOne({
          _id: conversationId,
          participants: socket.user._id,
        });

        if (!conversation) {
          return callback?.({
            success: false,
            message: "Conversation access denied",
          });
        }

        if (
          typeof content !== "string" ||
          content.length > 5000 ||
          !Array.isArray(attachments) ||
          attachments.length > 5
        ) {
          return callback?.({
            success: false,
            message: "Invalid message content or attachments",
          });
        }

        if (!content.trim() && attachments.length === 0) {
          return callback?.({
            success: false,
            message: "Message cannot be empty",
          });
        }

        if (replyTo) {
          const originalMessage = await DirectMessage.findOne({
            _id: replyTo,
            conversation: conversationId,
            deletedAt: null,
          });

          if (!originalMessage) {
            return callback?.({
              success: false,
              message: "Reply message not found",
            });
          }
        }

        const message = await DirectMessage.create({
          conversation: conversationId,
          sender: socket.user._id,
          content: content.trim(),
          replyTo,
          attachments,
        });

        conversation.lastMessage = message._id;
        conversation.lastMessageAt = message.createdAt;

        const readState = conversation.readStates.find(
          (state) => String(state.user) === String(socket.user._id)
        );

        if (readState) {
          readState.lastReadAt = new Date();
        } else {
          conversation.readStates.push({
            user: socket.user._id,
            lastReadAt: new Date(),
          });
        }

        await conversation.save();

        await message.populate("sender", "name email avatar");

        await message.populate({
          path: "replyTo",
          select: "content sender createdAt",
          populate: {
            path: "sender",
            select: "name avatar",
          },
        });

        const recipientId = conversation.participants.find(
          (participant) =>
            String(participant) !== String(socket.user._id)
        );

        
        if (recipientId) {
          try {
            await createNotification({
              recipient: recipientId,
              sender: socket.user._id,
              type: replyTo ? "direct_message_reply" : "direct_message",
              directMessage: message._id,
              conversation: conversation._id,
              content: content.trim() || "Sent an attachment",
            });
          } catch (notificationError) {
            console.error("DM notification error:", notificationError.message);
          }
        }

// Send to conversation members and their other connected devices.
        // The sender's current socket is excluded; its acknowledgement
        // supplies the newly created message.
        socket.to(`conversation:${conversationId}`)
          .to(`user:${recipientId}`)
          .emit("dm:message:new", message);

        callback?.({
          success: true,
          message,
        });
      } catch (error) {
        callback?.({
          success: false,
          message: error.message || "Could not send direct message",
        });
      }
    });

    // DIRECT MESSAGE TYPING START
    socket.on("dm:typing:start", async (conversationId) => {
      try {
        const conversation = await Conversation.findOne({
          _id: conversationId,
          participants: socket.user._id,
        });

        if (!conversation) return;

        socket.to(`conversation:${conversationId}`).emit(
          "dm:typing:start",
          {
            conversationId,
            userId,
            name: socket.user.name,
          }
        );
      } catch (error) {
        console.error("DM typing start error:", error.message);
      }
    });

    // DIRECT MESSAGE TYPING STOP
    socket.on("dm:typing:stop", async (conversationId) => {
      try {
        const conversation = await Conversation.findOne({
          _id: conversationId,
          participants: socket.user._id,
        });

        if (!conversation) return;

        socket.to(`conversation:${conversationId}`).emit(
          "dm:typing:stop",
          {
            conversationId,
            userId,
          }
        );
      } catch (error) {
        console.error("DM typing stop error:", error.message);
      }
    });

    // DIRECT MESSAGE UPDATED
    socket.on("dm:message:updated", async (messageId) => {
      try {
        const message = await DirectMessage.findById(messageId);

        if (!message || message.deletedAt) return;

        const conversation = await Conversation.findOne({
          _id: message.conversation,
          participants: socket.user._id,
        });

        if (!conversation) return;

        await message.populate("sender", "name email avatar");

        io.to(`conversation:${message.conversation}`).emit(
          "dm:message:updated",
          message
        );
      } catch (error) {
        console.error("DM update broadcast error:", error.message);
      }
    });

    // DIRECT MESSAGE DELETED
    socket.on("dm:message:deleted", async (messageId) => {
      try {
        const message = await DirectMessage.findById(messageId);

        if (!message || !message.deletedAt) return;

        const conversation = await Conversation.findOne({
          _id: message.conversation,
          participants: socket.user._id,
        });

        if (!conversation) return;

        io.to(`conversation:${message.conversation}`).emit(
          "dm:message:deleted",
          {
            _id: message._id,
            conversation: message.conversation,
            content: message.content,
            deletedAt: message.deletedAt,
          }
        );
      } catch (error) {
        console.error("DM delete broadcast error:", error.message);
      }
    });

    // ================= END DIRECT MESSAGES =================
    // JOIN CHANNEL
    socket.on("channel:join", async (channelId, callback) => {
      try {
        const access = await getAccessibleChannel(channelId, socket.user._id);

        if (!access) {
          return callback?.({
            success: false,
            message: "Channel access denied",
          });
        }

        socket.join(`channel:${channelId}`);

        callback?.({
          success: true,
          message: "Joined channel successfully",
        });
      } catch (error) {
        callback?.({
          success: false,
          message: "Unable to join channel",
        });
      }
    });

    // LEAVE CHANNEL
    socket.on("channel:leave", (channelId) => {
      socket.leave(`channel:${channelId}`);
    });

    // SEND MESSAGE
    socket.on("message:send", async (payload, callback) => {
      try {
        const { channelId, content, replyTo, mentionIds, attachments } = payload || {};

        const message = await createMessage({
          channelId,
          senderId: socket.user._id,
          content,
          replyTo,
          mentionIds,
        attachments,
        });

        io.to(`channel:${channelId}`).emit("message:new", message);

        callback?.({
          success: true,
          message,
        });
      } catch (error) {
        callback?.({
          success: false,
          message: error.message,
        });
      }
    });

    // MESSAGE UPDATED BROADCAST
    socket.on("message:updated", async (messageId) => {
      try {
        const message = await Message.findById(messageId).populate(
          "sender",
          "name email avatar",
        );

        if (!message || message.deletedAt) return;

        const access = await getAccessibleChannel(
          message.channel,
          socket.user._id,
        );

        if (!access) return;

        io.to(`channel:${message.channel}`).emit("message:updated", message);
      } catch (error) {
        console.error("Message update broadcast error:", error.message);
      }
    });

    // MESSAGE DELETED BROADCAST
    socket.on("message:deleted", async (messageId) => {
      try {
        const message = await Message.findById(messageId);

        if (!message || !message.deletedAt) return;

        const access = await getAccessibleChannel(
          message.channel,
          socket.user._id,
        );

        if (!access) return;

        io.to(`channel:${message.channel}`).emit("message:deleted", {
          _id: message._id,
          channel: message.channel,
          content: message.content,
          deletedAt: message.deletedAt,
        });
      } catch (error) {
        console.error("Message delete broadcast error:", error.message);
      }
    });

    // TYPING START
    socket.on("typing:start", async (channelId) => {
      try {
        const access = await getAccessibleChannel(channelId, socket.user._id);

        if (!access) return;

        socket.to(`channel:${channelId}`).emit("typing:start", {
          userId,
          name: socket.user.name,
          channelId,
        });
      } catch (error) {
        console.error("Typing start error:", error.message);
      }
    });

    // TYPING STOP
    socket.on("typing:stop", async (channelId) => {
      try {
        const access = await getAccessibleChannel(channelId, socket.user._id);

        if (!access) return;

        socket.to(`channel:${channelId}`).emit("typing:stop", {
          userId,
          channelId,
        });
      } catch (error) {
        console.error("Typing stop error:", error.message);
      }
    });

    // DISCONNECT
    socket.on("disconnect", async () => {
      const wentOffline = removeOnlineUser(userId, socket.id);

      if (wentOffline) {
        const lastSeen = new Date();

        try {
          await User.findByIdAndUpdate(userId, {
            $set: { lastSeen },
          });
        } catch (error) {
          console.error("Could not save last seen:", error.message);
        }

        io.emit("presence:offline", {
          userId,
          lastSeen,
          onlineUsers: getOnlineUsers(),
        });
      }

      console.log(`User disconnected: ${socket.user.name}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO has not been initialized");
  }

  return io;
};
