import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import mongoose from "mongoose";

import Notification from "../../src/models/Notification.js";
import User from "../../src/models/User.js";
import * as socketService from "../../src/sockets/socket.js";

import { createNotification } from "../../src/services/notificationService.js";

describe("Notification Service", () => {
  const recipientId = new mongoose.Types.ObjectId().toString();
  const senderId = new mongoose.Types.ObjectId().toString();
  const messageId = new mongoose.Types.ObjectId().toString();
  const conversationId = new mongoose.Types.ObjectId().toString();
  const notificationId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    vi.spyOn(Notification, "create").mockResolvedValue({ _id: notificationId });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockRecipient = (preferences = {}) => {
    const user = {
      _id: recipientId,
      notificationPreferences: preferences,
    };

    vi.spyOn(User, "findById").mockReturnValue({
      select: vi.fn().mockResolvedValue(user),
    });

    return user;
  };

  const mockSocket = ({ sockets = [], emitError = null } = {}) => {
    const emit = vi.fn();

    if (emitError) {
      emit.mockImplementation(() => {
        throw emitError;
      });
    }

    const io = {
      in: vi.fn().mockReturnValue({
        fetchSockets: vi.fn().mockResolvedValue(sockets),
      }),
      to: vi.fn().mockReturnValue({ emit }),
    };

    vi.spyOn(socketService, "getIO").mockReturnValue(io);

    return { io, emit };
  };

  const mockNotificationCreation = (populatedNotification = {
    _id: notificationId,
  }) => {
    const notification = { _id: notificationId };

    vi.spyOn(Notification, "create").mockResolvedValue(notification);

    const query = {
      populate: vi.fn().mockReturnThis(),
    };

    query.then = (resolve, reject) =>
      Promise.resolve(populatedNotification).then(resolve, reject);

    vi.spyOn(Notification, "findById").mockReturnValue(query);

    return { notification, query };
  };

  it("ignores notifications sent to the sender themselves", async () => {
    const userSpy = vi.spyOn(User, "findById");

    const result = await createNotification({
      recipient: senderId,
      sender: senderId,
      type: "new_message",
    });

    expect(result).toBeNull();
    expect(userSpy).not.toHaveBeenCalled();
    expect(Notification.create).not.toHaveBeenCalled();
  });

  it("ignores notifications when the recipient does not exist", async () => {
    vi.spyOn(User, "findById").mockReturnValue({
      select: vi.fn().mockResolvedValue(null),
    });

    const result = await createNotification({
      recipient: recipientId,
      sender: senderId,
      type: "new_message",
    });

    expect(result).toBeNull();
    expect(Notification.create).not.toHaveBeenCalled();
  });

  it("respects disabled direct message notification preferences", async () => {
    mockRecipient({ directMessages: false });

    const result = await createNotification({
      recipient: recipientId,
      sender: senderId,
      type: "direct_message",
    });

    expect(result).toBeNull();
    expect(Notification.create).not.toHaveBeenCalled();
  });

  it("returns an existing notification for a duplicate direct message", async () => {
    mockRecipient();

    const existingNotification = { _id: notificationId };

    vi.spyOn(Notification, "findOne").mockReturnValue({
      select: vi.fn().mockResolvedValue(existingNotification),
    });

    const result = await createNotification({
      recipient: recipientId,
      sender: senderId,
      type: "direct_message",
      directMessage: messageId,
    });

    expect(result).toBe(existingNotification);

    expect(Notification.findOne).toHaveBeenCalledWith({
      recipient: recipientId,
      directMessage: messageId,
      type: {
        $in: ["direct_message", "direct_message_reply"],
      },
    });

    expect(Notification.create).not.toHaveBeenCalled();
  });

  it("suppresses DM notifications when the recipient is viewing the conversation", async () => {
    mockRecipient();

    vi.spyOn(Notification, "findOne").mockReturnValue({
      select: vi.fn().mockResolvedValue(null),
    });

    const activeSocket = {
      rooms: new Set([
        `user:${recipientId}`,
        `conversation:${conversationId}`,
      ]),
    };

    const { io } = mockSocket({
      sockets: [activeSocket],
    });

    const result = await createNotification({
      recipient: recipientId,
      sender: senderId,
      type: "direct_message",
      directMessage: messageId,
      conversation: conversationId,
    });

    expect(result).toBeNull();
    expect(io.in).toHaveBeenCalledWith(`user:${recipientId}`);
    expect(Notification.create).not.toHaveBeenCalled();
  });

  it("creates and emits notifications to the recipient", async () => {
    mockRecipient();

    const populatedNotification = {
      _id: notificationId,
      content: "Hello CIRQL",
    };

    const { query } = mockNotificationCreation(populatedNotification);
    const { io, emit } = mockSocket();

    const result = await createNotification({
      recipient: recipientId,
      sender: senderId,
      type: "new_message",
      content: "Hello CIRQL",
    });

    expect(result).toEqual({ _id: notificationId });

    expect(Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: recipientId,
        sender: senderId,
        type: "new_message",
        content: "Hello CIRQL",
      })
    );

    expect(query.populate).toHaveBeenCalledTimes(3);
    expect(io.to).toHaveBeenCalledWith(`user:${recipientId}`);
    expect(emit).toHaveBeenCalledWith(
      "notification:new",
      populatedNotification
    );
  });

  it("allows workspace invitations even when notification preferences are disabled", async () => {
    mockRecipient({
      directMessages: false,
      replies: false,
      mentions: false,
      channelMessages: false,
      sound: false,
    });

    mockNotificationCreation();
    mockSocket();

    const result = await createNotification({
      recipient: recipientId,
      sender: senderId,
      type: "workspace_invitation",
      content: "You have been invited",
    });

    expect(result).toBeDefined();
    expect(Notification.create).toHaveBeenCalled();
  });

  it("truncates notification content to 200 characters", async () => {
    mockRecipient();
    mockNotificationCreation();
    mockSocket();

    const longContent = "A".repeat(250);

    await createNotification({
      recipient: recipientId,
      sender: senderId,
      type: "new_message",
      content: longContent,
    });

    expect(Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "A".repeat(200),
      })
    );
  });

  it("does not fail when socket notification emission fails", async () => {
    mockRecipient();
    mockNotificationCreation();

    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    mockSocket({
      emitError: new Error("Socket unavailable"),
    });

    const result = await createNotification({
      recipient: recipientId,
      sender: senderId,
      type: "new_message",
      content: "Still save this notification",
    });

    expect(result).toBeDefined();
    expect(Notification.create).toHaveBeenCalled();

    expect(consoleSpy).toHaveBeenCalledWith(
      "Notification socket emission failed:",
      "Socket unavailable"
    );
  });
});


