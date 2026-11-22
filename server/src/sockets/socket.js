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

    io.emit("presence:online", {
      userId,
      onlineUsers: getOnlineUsers(),
    });

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
        const { channelId, content, replyTo, mentionIds } = payload || {};

        const message = await createMessage({
          channelId,
          senderId: socket.user._id,
          content,
          replyTo,
          mentionIds,
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
    socket.on("disconnect", () => {
      const wentOffline = removeOnlineUser(userId, socket.id);

      if (wentOffline) {
        io.emit("presence:offline", {
          userId,
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
