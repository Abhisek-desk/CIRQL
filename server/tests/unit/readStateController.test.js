import { describe, it, expect, vi, afterEach } from "vitest";
import mongoose from "mongoose";

import Workspace from "../../src/models/Workspace.js";
import Channel from "../../src/models/Channel.js";
import Message from "../../src/models/Message.js";
import ChannelReadState from "../../src/models/ChannelReadState.js";
import * as socketService from "../../src/sockets/socket.js";

import {
  getUnreadCounts,
  getChannelReadReceipts,
  markChannelAsRead,
} from "../../src/controllers/readStateController.js";

describe("Read State Controller", () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const workspaceId = new mongoose.Types.ObjectId().toString();
  const channelId = new mongoose.Types.ObjectId().toString();
  const messageId = new mongoose.Types.ObjectId().toString();

  const user = {
    _id: userId,
    name: "Test User",
    avatar: "",
  };

  const workspace = {
    members: [{ userId }],
  };

  const channel = {
    _id: channelId,
    workspace: workspaceId,
    type: "public",
    members: [],
  };

  const createResponse = () => {
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    return res;
  };

  const createRequest = (params = {}) => ({
    params,
    user,
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects invalid workspace IDs", async () => {
    const req = createRequest({ workspaceId: "invalid" });
    const res = createResponse();
    const next = vi.fn();

    await getUnreadCounts(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Invalid workspace ID",
      })
    );
  });

  it("denies unread counts to non-workspace members", async () => {
    vi.spyOn(Workspace, "findById").mockResolvedValue({
      members: [],
    });

    const req = createRequest({ workspaceId });
    const res = createResponse();

    await getUnreadCounts(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Workspace access denied",
      })
    );
  });

  it("returns unread counts for accessible channels", async () => {
    vi.spyOn(Workspace, "findById").mockResolvedValue(workspace);

    vi.spyOn(Channel, "find").mockReturnValue({
      select: vi.fn().mockResolvedValue([{ _id: channelId }]),
    });

    vi.spyOn(ChannelReadState, "find").mockResolvedValue([]);

    vi.spyOn(Message, "countDocuments").mockResolvedValue(3);

    const req = createRequest({ workspaceId });
    const res = createResponse();

    await getUnreadCounts(req, res, vi.fn());

    expect(Message.countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: channelId,
        deletedAt: null,
        sender: { $ne: userId },
      })
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      unreadCounts: [{ channelId, count: 3 }],
    });
  });

  it("rejects invalid channel IDs when retrieving read receipts", async () => {
    const req = createRequest({ channelId: "invalid" });
    const res = createResponse();

    await getChannelReadReceipts(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Invalid channel ID",
      })
    );
  });

  it("returns read receipts for channel members", async () => {
    vi.spyOn(Channel, "findById").mockResolvedValue(channel);
    vi.spyOn(Workspace, "findById").mockResolvedValue(workspace);

    const readStates = [
      {
        user: { _id: userId, name: "Test User" },
        lastReadAt: new Date(),
      },
      {
        user: null,
        lastReadAt: new Date(),
      },
    ];

    const query = {
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(readStates),
    };

    vi.spyOn(ChannelReadState, "find").mockReturnValue(query);

    const req = createRequest({ channelId });
    const res = createResponse();

    await getChannelReadReceipts(req, res, vi.fn());

    expect(query.populate).toHaveBeenCalledWith("user", "name avatar");
    expect(query.sort).toHaveBeenCalledWith({ lastReadAt: -1 });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      readStates: [readStates[0]],
    });
  });

  it("marks a channel as read and broadcasts the read receipt", async () => {
    vi.spyOn(Channel, "findById").mockResolvedValue(channel);
    vi.spyOn(Workspace, "findById").mockResolvedValue(workspace);

    vi.spyOn(ChannelReadState, "findOne").mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });

    const firstUnreadQuery = {
      sort: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ _id: messageId }),
    };

    vi.spyOn(Message, "findOne").mockReturnValue(firstUnreadQuery);

    const updateSpy = vi
      .spyOn(ChannelReadState, "findOneAndUpdate")
      .mockResolvedValue({});

    const emit = vi.fn();

    const io = {
      to: vi.fn().mockReturnValue({ emit }),
    };

    vi.spyOn(socketService, "getIO").mockReturnValue(io);

    const req = createRequest({ channelId });
    const res = createResponse();

    await markChannelAsRead(req, res, vi.fn());

    expect(updateSpy).toHaveBeenCalledWith(
      { user: userId, channel: channelId },
      { $set: { lastReadAt: expect.any(Date) } },
      { upsert: true, new: true, runValidators: true }
    );

    expect(io.to).toHaveBeenCalledWith(`channel:${channelId}`);
    expect(emit).toHaveBeenCalledWith(
      "channel:read",
      expect.objectContaining({
        channelId,
        user: expect.objectContaining({
          _id: userId,
          name: "Test User",
        }),
      })
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "Channel marked as read",
        firstUnreadMessageId: messageId,
      })
    );
  });

  it("does not fail marking a channel as read when socket broadcasting fails", async () => {
    vi.spyOn(Channel, "findById").mockResolvedValue(channel);
    vi.spyOn(Workspace, "findById").mockResolvedValue(workspace);

    vi.spyOn(ChannelReadState, "findOne").mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });

    vi.spyOn(Message, "findOne").mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(null),
    });

    vi.spyOn(ChannelReadState, "findOneAndUpdate").mockResolvedValue({});

    vi.spyOn(socketService, "getIO").mockImplementation(() => {
      throw new Error("Socket unavailable");
    });

    vi.spyOn(console, "error").mockImplementation(() => {});

    const req = createRequest({ channelId });
    const res = createResponse();

    await markChannelAsRead(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "Channel marked as read",
        firstUnreadMessageId: null,
      })
    );
  });
});
