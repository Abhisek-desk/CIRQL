import { describe, it, expect, vi, afterEach } from "vitest";

import mongoose from "mongoose";
import Channel from "../../src/models/Channel.js";
import Workspace from "../../src/models/Workspace.js";

import {
  getAccessibleChannel,
} from "../../src/services/channelAccess.js";

describe("Channel Access Service", () => {
  const userId = "6b0450880b78331db781c7b1";
  const otherUserId = "6b0450880b78331db781c7b2";
  const channelId = "6b0450880b78331db781c7b3";
  const workspaceId = "6b0450880b78331db781c7b4";

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects invalid channel IDs without querying MongoDB", async () => {
    const channelSpy = vi.spyOn(Channel, "findById");

    const result = await getAccessibleChannel("invalid-id", userId);

    expect(result).toBeNull();
    expect(channelSpy).not.toHaveBeenCalled();
  });

  it("returns null when the channel does not exist", async () => {
    vi.spyOn(Channel, "findById").mockResolvedValue(null);

    const result = await getAccessibleChannel(channelId, userId);

    expect(result).toBeNull();
  });

  it("returns null when the workspace does not exist", async () => {
    vi.spyOn(Channel, "findById").mockResolvedValue({
      _id: channelId,
      workspace: workspaceId,
      type: "public",
    });

    vi.spyOn(Workspace, "findById").mockResolvedValue(null);

    const result = await getAccessibleChannel(channelId, userId);

    expect(result).toBeNull();
  });

  it("denies users who are not workspace members", async () => {
    vi.spyOn(Channel, "findById").mockResolvedValue({
      _id: channelId,
      workspace: workspaceId,
      type: "public",
    });

    vi.spyOn(Workspace, "findById").mockResolvedValue({
      members: [
        { userId: otherUserId },
      ],
    });

    const result = await getAccessibleChannel(channelId, userId);

    expect(result).toBeNull();
  });

  it("allows workspace members to access public channels", async () => {
    const mockChannel = {
      _id: channelId,
      workspace: workspaceId,
      type: "public",
    };

    const mockWorkspace = {
      members: [
        { userId },
      ],
    };

    vi.spyOn(Channel, "findById").mockResolvedValue(mockChannel);
    vi.spyOn(Workspace, "findById").mockResolvedValue(mockWorkspace);

    const result = await getAccessibleChannel(channelId, userId);

    expect(result).toEqual({
      channel: mockChannel,
      workspace: mockWorkspace,
    });
  });

  it("denies workspace members who are not private channel members", async () => {
    vi.spyOn(Channel, "findById").mockResolvedValue({
      _id: channelId,
      workspace: workspaceId,
      type: "private",
      members: [otherUserId],
    });

    vi.spyOn(Workspace, "findById").mockResolvedValue({
      members: [
        { userId },
      ],
    });

    const result = await getAccessibleChannel(channelId, userId);

    expect(result).toBeNull();
  });

  it("allows authorized private channel members", async () => {
    const mockChannel = {
      _id: channelId,
      workspace: workspaceId,
      type: "private",
      members: [userId],
    };

    const mockWorkspace = {
      members: [
        { userId },
      ],
    };

    vi.spyOn(Channel, "findById").mockResolvedValue(mockChannel);
    vi.spyOn(Workspace, "findById").mockResolvedValue(mockWorkspace);

    const result = await getAccessibleChannel(channelId, userId);

    expect(result.channel).toBe(mockChannel);
    expect(result.workspace).toBe(mockWorkspace);
  });
});
