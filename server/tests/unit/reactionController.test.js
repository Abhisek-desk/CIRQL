import { describe, it, expect, vi, afterEach } from "vitest";
import mongoose from "mongoose";

import Message from "../../src/models/Message.js";
import * as channelAccess from "../../src/services/channelAccess.js";
import * as socketService from "../../src/sockets/socket.js";

import { toggleReaction } from "../../src/controllers/reactionController.js";

describe("Reaction Controller", () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const messageId = new mongoose.Types.ObjectId().toString();
  const channelId = new mongoose.Types.ObjectId().toString();

  const user = { _id: userId };

  const createResponse = () => ({
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  });

  const createRequest = (emoji, id = messageId) => ({
    params: { messageId: id },
    body: { emoji },
    user,
  });

  const mockMessage = (reactions = []) => {
    const message = {
      _id: messageId,
      channel: channelId,
      deletedAt: null,
      reactions,
      save: vi.fn().mockResolvedValue(true),
    };

    vi.spyOn(Message, "findById").mockResolvedValue(message);

    vi.spyOn(channelAccess, "getAccessibleChannel")
      .mockResolvedValue({ channel: { _id: channelId } });

    return message;
  };

  const mockSocket = () => {
    const emit = vi.fn();

    const io = {
      to: vi.fn().mockReturnValue({ emit }),
    };

    vi.spyOn(socketService, "getIO").mockReturnValue(io);

    return { io, emit };
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects invalid message IDs", async () => {
    const req = createRequest("👍", "invalid");
    const res = createResponse();

    await toggleReaction(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Invalid message ID",
      })
    );
  });

  it("rejects unsupported emojis", async () => {
    const req = createRequest("🔥");
    const res = createResponse();

    await toggleReaction(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Unsupported emoji",
      })
    );
  });

  it("returns 404 when the message does not exist", async () => {
    vi.spyOn(Message, "findById").mockResolvedValue(null);

    const req = createRequest("👍");
    const res = createResponse();

    await toggleReaction(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Message not found",
      })
    );
  });

  it("adds a reaction and broadcasts the updated reactions", async () => {
    const message = mockMessage();
    const { io, emit } = mockSocket();

    const req = createRequest("👍");
    const res = createResponse();

    await toggleReaction(req, res, vi.fn());

    expect(message.save).toHaveBeenCalled();

    expect(message.reactions).toEqual([
      { user: userId, emoji: "👍" },
    ]);

    expect(io.to).toHaveBeenCalledWith(`channel:${channelId}`);

    expect(emit).toHaveBeenCalledWith(
      "message:reactions",
      expect.objectContaining({
        messageId,
        channelId,
        reactions: [{ user: userId, emoji: "👍" }],
      })
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "Reaction added successfully",
      })
    );
  });

  it("removes an existing reaction when toggled again", async () => {
    const message = mockMessage([
      { user: userId, emoji: "❤️" },
    ]);

    mockSocket();

    const req = createRequest("❤️");
    const res = createResponse();

    await toggleReaction(req, res, vi.fn());

    expect(message.reactions).toHaveLength(0);
    expect(message.save).toHaveBeenCalled();

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "Reaction removed successfully",
        reactions: [],
      })
    );
  });

  it("denies reactions when the user cannot access the channel", async () => {
    const message = mockMessage();

    vi.spyOn(channelAccess, "getAccessibleChannel")
      .mockResolvedValue(null);

    const req = createRequest("🚀");
    const res = createResponse();

    await toggleReaction(req, res, vi.fn());

    expect(message.save).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Channel not found or access denied",
      })
    );
  });
});
