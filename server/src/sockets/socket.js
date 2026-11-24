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
import Call from "../models/Call.js";
import { createNotification } from "../services/notificationService.js";

import { validateAttachments } from "../utils/fileValidation.js";

let io;
const callTimers = new Map();
const CALL_RING_TIMEOUT = 30_000;

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

      const decoded = jwt.verify(
        token,
        process.env.JWT_ACCESS_SECRET,
      );

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
          content.length > 5000
        ) {
          return callback?.({
            success: false,
            message: "Invalid message content",
          });
        }

        // Validate attachment metadata.
        let validAttachments;

        try {
          validAttachments = validateAttachments(attachments);
        } catch (validationError) {
          return callback?.({
            success: false,
            message: validationError.message,
          });
        }

        if (!content.trim() && validAttachments.length === 0) {
          return callback?.({
            success: false,
            message: "Message cannot be empty",
          });
        }

        // Validate reply target.
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

        // Create direct message using validated attachments.
        const message = await DirectMessage.create({
          conversation: conversationId,
          sender: socket.user._id,
          content: content.trim(),
          replyTo,
          attachments: validAttachments,
        });

        conversation.lastMessage = message._id;
        conversation.lastMessageAt = message.createdAt;

        const readState = conversation.readStates.find(
          (state) =>
            String(state.user) === String(socket.user._id),
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
            String(participant) !== String(socket.user._id),
        );

        // Create notification.
        if (recipientId) {
          try {
            await createNotification({
              recipient: recipientId,
              sender: socket.user._id,
              type: replyTo
                ? "direct_message_reply"
                : "direct_message",
              directMessage: message._id,
              conversation: conversation._id,
              content: content.trim() || "Sent an attachment",
            });
          } catch (notificationError) {
            console.error(
              "DM notification error:",
              notificationError.message,
            );
          }
        }

        // Send to conversation members and their other connected devices.
        // The sender's current socket is excluded.
        if (recipientId) {
          socket
            .to(`conversation:${conversationId}`)
            .to(`user:${recipientId}`)
            .emit("dm:message:new", message);
        }

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
          },
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
          },
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
          message,
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
          },
        );
      } catch (error) {
        console.error("DM delete broadcast error:", error.message);
      }
    });

    // ================= END DIRECT MESSAGES =================

    // JOIN CHANNEL
    socket.on("channel:join", async (channelId, callback) => {
      try {
        const access = await getAccessibleChannel(
          channelId,
          socket.user._id,
        );

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

    // SEND CHANNEL MESSAGE
    socket.on("message:send", async (payload, callback) => {
      try {
        const {
          channelId,
          content,
          replyTo,
          mentionIds,
          attachments,
        } = payload || {};

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

        io.to(`channel:${message.channel}`).emit(
          "message:updated",
          message,
        );
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

        io.to(`channel:${message.channel}`).emit(
          "message:deleted",
          {
            _id: message._id,
            channel: message.channel,
            content: message.content,
            deletedAt: message.deletedAt,
          },
        );
      } catch (error) {
        console.error("Message delete broadcast error:", error.message);
      }
    });

    // TYPING START
    socket.on("typing:start", async (channelId) => {
      try {
        const access = await getAccessibleChannel(
          channelId,
          socket.user._id,
        );

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
        const access = await getAccessibleChannel(
          channelId,
          socket.user._id,
        );

        if (!access) return;

        socket.to(`channel:${channelId}`).emit("typing:stop", {
          userId,
          channelId,
        });
      } catch (error) {
        console.error("Typing stop error:", error.message);
      }
    });


    // ================= CALL SIGNALING - CIRQL =================

    const getCallParticipants = async (conversationId) => {
      if (!conversationId) return null;

      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: socket.user._id,
      });

      if (!conversation || conversation.participants.length !== 2) {
        return null;
      }

      const otherUserId = conversation.participants
        .map(String)
        .find((id) => id !== userId);

      return otherUserId ? { conversation, otherUserId } : null;
    };

    const clearCallTimer = (callId) => {
      const timer = callTimers.get(callId);

      if (timer) {
        clearTimeout(timer);
        callTimers.delete(callId);
      }
    };

    const scheduleMissedCall = (call) => {
      clearCallTimer(call.callId);

      const timer = setTimeout(async () => {
        try {
          const missedCall = await Call.findOneAndUpdate(
            {
              callId: call.callId,
              status: "ringing",
            },
            {
              $set: {
                status: "missed",
                endedAt: new Date(),
                durationSeconds: 0,
              },
            },
            { new: true }
          );

          if (missedCall) {
            const payload = {
              callId: call.callId,
              conversationId: String(call.conversation),
              status: "missed",
            };

            io.to(`user:${String(call.caller)}`).emit(
              "call:missed",
              payload
            );

            io.to(`user:${String(call.callee)}`).emit(
              "call:missed",
              payload
            );
          }
        } catch (error) {
          console.error("Missed call timeout error:", error.message);
        } finally {
          callTimers.delete(call.callId);
        }
      }, CALL_RING_TIMEOUT);

      timer.unref?.();
      callTimers.set(call.callId, timer);
    };

    const finishCall = async (payload, finalStatus, allowedStatuses) => {
      try {
        const { callId, conversationId } = payload || {};

        if (
          typeof callId !== "string" ||
          typeof conversationId !== "string"
        ) {
          return;
        }

        const call = await Call.findOne({
          callId,
          conversation: conversationId,
          $or: [
            { caller: socket.user._id },
            { callee: socket.user._id },
          ],
          status: { $in: allowedStatuses },
        });

        if (!call) return;

        // Only the callee may reject an incoming ringing call.
        if (finalStatus === "rejected" &&
            String(call.callee) !== userId) {
          return;
        }

        // Only the caller may cancel an unanswered outgoing call.
        if (finalStatus === "cancelled" &&
            String(call.caller) !== userId) {
          return;
        }

        const endedAt = new Date();
        const durationSeconds = call.answeredAt
          ? Math.max(
              0,
              Math.floor((endedAt - call.answeredAt) / 1000)
            )
          : 0;

        const updated = await Call.findOneAndUpdate(
          {
            _id: call._id,
            status: { $in: allowedStatuses },
          },
          {
            $set: {
              status: finalStatus,
              endedAt,
              durationSeconds,
            },
          },
          { new: true }
        );

        if (!updated) return;

        clearCallTimer(callId);

        const otherUserId =
          String(call.caller) === userId
            ? String(call.callee)
            : String(call.caller);

        const eventName =
          finalStatus === "rejected"
            ? "call:rejected"
            : "call:ended";

        io.to(`user:${otherUserId}`).emit(eventName, {
          callId,
          conversationId: String(conversationId),
          status: finalStatus,
          durationSeconds,
        });
      } catch (error) {
        console.error("Call completion error:", error.message);
      }
    };

    socket.on("call:invite", async (payload, callback) => {
      try {
        const { conversationId, callId, mode } = payload || {};

        if (
          typeof callId !== "string" ||
          callId.length < 1 ||
          callId.length > 100 ||
          !["audio", "video"].includes(mode)
        ) {
          return callback?.({
            success: false,
            message: "Invalid call.",
          });
        }

        const participants = await getCallParticipants(conversationId);

        if (!participants) {
          return callback?.({
            success: false,
            message: "Conversation access denied.",
          });
        }

        const { otherUserId } = participants;

        const busyCall = await Call.findOne({
          status: { $in: ["ringing", "ongoing"] },
          $or: [
            { caller: { $in: [userId, otherUserId] } },
            { callee: { $in: [userId, otherUserId] } },
          ],
        }).lean();

        if (busyCall) {
          return callback?.({
            success: false,
            message: "One of the participants is already in a call.",
          });
        }

        const call = await Call.create({
          callId,
          conversation: conversationId,
          caller: userId,
          callee: otherUserId,
          mode,
          status: "ringing",
        });

        scheduleMissedCall(call);

        io.to(`user:${otherUserId}`).emit("call:incoming", {
          callId,
          conversationId: String(conversationId),
          callerId: userId,
          callerName: socket.user.name,
          mode,
        });

        callback?.({ success: true });
      } catch (error) {
        console.error("Call invite error:", error.message);

        callback?.({
          success: false,
          message:
            error.code === 11000
              ? "This call has already been started."
              : "Unable to start call.",
        });
      }
    });

    // Only the intended callee can accept a ringing call.
    socket.on("call:accept", async (payload) => {
      try {
        const { callId, conversationId } = payload || {};

        const call = await Call.findOneAndUpdate(
          {
            callId,
            conversation: conversationId,
            callee: socket.user._id,
            status: "ringing",
          },
          {
            $set: {
              status: "ongoing",
              answeredAt: new Date(),
            },
          },
          { new: true }
        );

        if (!call) return;

        clearCallTimer(callId);

        io.to(`user:${String(call.caller)}`).emit("call:accepted", {
          callId,
          conversationId: String(conversationId),
        });
      } catch (error) {
        console.error("Call accept error:", error.message);
      }
    });

    // SDP and ICE signals are relayed only for an active call
    // and only between its two authenticated participants.
    const forwardActiveCallSignal = async (eventName, payload) => {
      try {
        const { conversationId, callId } = payload || {};

        if (
          typeof callId !== "string" ||
          typeof conversationId !== "string"
        ) {
          return;
        }

        const call = await Call.findOne({
          callId,
          conversation: conversationId,
          status: "ongoing",
          $or: [
            { caller: socket.user._id },
            { callee: socket.user._id },
          ],
        }).lean();

        if (!call) return;

        const otherUserId =
          String(call.caller) === userId
            ? String(call.callee)
            : String(call.caller);

        socket.to(`user:${otherUserId}`).emit(eventName, {
          ...payload,
          conversationId: String(conversationId),
          senderId: userId,
        });
      } catch (error) {
        console.error(`${eventName} error:`, error.message);
      }
    };

    socket.on("call:offer", (payload) => {
      forwardActiveCallSignal("call:offer", payload);
    });

    socket.on("call:answer", (payload) => {
      forwardActiveCallSignal("call:answer", payload);
    });

    socket.on("call:ice", (payload) => {
      forwardActiveCallSignal("call:ice", payload);
    });

    socket.on("call:reject", (payload) => {
      finishCall(payload, "rejected", ["ringing"]);
    });

    socket.on("call:cancel", (payload) => {
      finishCall(payload, "cancelled", ["ringing"]);
    });

    socket.on("call:end", (payload) => {
      finishCall(payload, "completed", ["ongoing"]);
    });

    // ==========================================================
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

