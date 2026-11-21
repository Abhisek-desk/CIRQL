import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Message from "../models/Message.js";

import { createMessage } from "../services/messageService.js";
import { getAccessibleChannel } from "../services/channelAccess.js";

import {
  addOnlineUser,
  removeOnlineUser,
  getOnlineUsers,
} from "../services/presenceService.js";

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

  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.user.name}`);

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

        const room = `channel:${channelId}`;

        socket.join(room);

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
        const { channelId, content, replyTo } = payload || {};

        const message = await createMessage({
          channelId,
          senderId: socket.user._id,
          content,
          replyTo,
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

    // TYPING START
    socket.on("typing:start", async (channelId) => {
      const access = await getAccessibleChannel(channelId, socket.user._id);

      if (!access) return;

      socket.to(`channel:${channelId}`).emit("typing:start", {
        userId: socket.user._id,
        name: socket.user.name,
        channelId,
      });
    });

    // TYPING STOP
    socket.on("typing:stop", async (channelId) => {
      const access = await getAccessibleChannel(channelId, socket.user._id);

      if (!access) return;

      socket.to(`channel:${channelId}`).emit("typing:stop", {
        userId: socket.user._id,
        channelId,
      });
    });

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

  const userId = socket.user._id.toString();

  addOnlineUser(userId, socket.id);

  io.emit("presence:online", {
    userId,
    onlineUsers: getOnlineUsers(),
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO has not been initialized");
  }

  return io;
};
