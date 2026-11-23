import { describe, it, expect, vi, afterEach } from "vitest";
import mongoose from "mongoose";

import Message from "../../src/models/Message.js";
import Workspace from "../../src/models/Workspace.js";
import Channel from "../../src/models/Channel.js";

import { getAccessibleChannel } from "../../src/services/channelAccess.js";
import * as notificationService from "../../src/services/notificationService.js";
import { createMessage } from "../../src/services/messageService.js";

describe("Message Service", () => {
  const senderId = new mongoose.Types.ObjectId().toString();
  const recipientId = new mongoose.Types.ObjectId().toString();
  const channelId = new mongoose.Types.ObjectId().toString();
  const workspaceId = new mongoose.Types.ObjectId().toString();
  const messageId = new mongoose.Types.ObjectId().toString();

  const channel = {
    _id: channelId,
    workspace: workspaceId,
    type: "public",
    members: [],
  };

  const workspace = {
    members: [
      { userId: senderId },
      { userId: recipientId },
    ],
  };

  const validAttachment = {
    url: "https://example.com/file.png",
    publicId: "cirql/file",
    name: "file.png",
    size: 1024,
    format: "png",
    resourceType: "image",
    mimeType: "image/png",
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const allowChannel = () => {
    vi.spyOn(Channel, "findById").mockResolvedValue(channel);
    vi.spyOn(Workspace, "findById").mockResolvedValue(workspace);
  };

  const mockMessageCreation = (populatedMessage = { _id: messageId }) => {
    vi.spyOn(Message, "create").mockResolvedValue({ _id: messageId });

    const populateReply = vi.fn().mockResolvedValue(populatedMessage);
    const populateSender = vi.fn().mockReturnValue({
      populate: populateReply,
    });

    vi.spyOn(Message, "findById").mockReturnValue({
      populate: populateSender,
    });
  };

  it("rejects messages when channel access is denied", async () => {
    vi.spyOn(Channel, "findById").mockResolvedValue(null);

    await expect(
      createMessage({ channelId, senderId, content: "Hello" })
    ).rejects.toThrow("Channel not found or access denied");
  });

  it("rejects empty messages without attachments", async () => {
    allowChannel();

    await expect(
      createMessage({ channelId, senderId, content: "   " })
    ).rejects.toThrow("Message must contain text or an attachment");
  });

  it("rejects content longer than 5000 characters", async () => {
    allowChannel();

    await expect(
      createMessage({ channelId, senderId, content: "a".repeat(5001) })
    ).rejects.toThrow("Message cannot exceed 5000 characters");
  });

  it("rejects more than five attachments", async () => {
    allowChannel();

    const attachments = Array.from({ length: 6 }, (_, index) => ({
      ...validAttachment,
      name: `file-${index}.png`,
    }));

    await expect(
      createMessage({ channelId, senderId, attachments })
    ).rejects.toThrow("A message can contain at most 5 attachments");
  });

  it("rejects invalid attachment data", async () => {
    allowChannel();

    await expect(
      createMessage({
        channelId,
        senderId,
        attachments: [{ ...validAttachment, size: 0 }],
      })
    ).rejects.toThrow("Invalid attachment data");
  });

  it("rejects invalid reply message IDs", async () => {
    allowChannel();

    await expect(
      createMessage({
        channelId,
        senderId,
        content: "Reply",
        replyTo: "invalid-id",
      })
    ).rejects.toThrow("Invalid reply message ID");
  });

  it("rejects replies to missing or deleted messages", async () => {
    allowChannel();

    vi.spyOn(Message, "findOne").mockResolvedValue(null);

    await expect(
      createMessage({
        channelId,
        senderId,
        content: "Reply",
        replyTo: messageId,
      })
    ).rejects.toThrow("Reply message not found");
  });

  it("rejects messages when the workspace does not exist", async () => {
    vi.spyOn(Channel, "findById").mockResolvedValue(channel);
    vi.spyOn(Workspace, "findById")
      .mockResolvedValueOnce(workspace)
      .mockResolvedValueOnce(null);

    await expect(
      createMessage({
        channelId,
        senderId,
        content: "Hello",
      })
    ).rejects.toThrow("Workspace not found");
  });

  it("trims content and creates a valid message", async () => {
    allowChannel();

    vi.spyOn(notificationService, "createNotification")
      .mockResolvedValue(null);

    const populatedMessage = {
      _id: messageId,
      content: "Hello CIRQL",
    };

    mockMessageCreation(populatedMessage);

    const result = await createMessage({
      channelId,
      senderId,
      content: "  Hello CIRQL  ",
    });

    expect(result).toEqual(populatedMessage);

    expect(Message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: channelId,
        sender: senderId,
        content: "Hello CIRQL",
        replyTo: null,
        attachments: [],
      })
    );
  });

  it("does not notify the sender about their own message", async () => {
    allowChannel();
    mockMessageCreation();

    const notificationSpy = vi
      .spyOn(notificationService, "createNotification")
      .mockResolvedValue(null);

    await createMessage({
      channelId,
      senderId,
      content: "Hello",
    });

    expect(notificationSpy).toHaveBeenCalledTimes(1);
    expect(notificationSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: recipientId,
        sender: senderId,
        type: "new_message",
      })
    );

    expect(
      notificationSpy.mock.calls.some(
        ([notification]) => String(notification.recipient) === senderId
      )
    ).toBe(false);
  });
  it("creates messages with valid attachments", async () => {
    allowChannel();
    mockMessageCreation();

    vi.spyOn(notificationService, "createNotification")
      .mockResolvedValue(null);

    await createMessage({
      channelId,
      senderId,
      attachments: [validAttachment],
    });

    expect(Message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          expect.objectContaining({
            url: validAttachment.url,
            publicId: validAttachment.publicId,
            name: validAttachment.name,
            size: validAttachment.size,
          }),
        ],
      })
    );
  });

  it("creates replies when the parent message exists", async () => {
    allowChannel();

    vi.spyOn(Message, "findOne").mockResolvedValue({
      _id: messageId,
      channel: channelId,
      deletedAt: null,
    });

    mockMessageCreation();

    vi.spyOn(notificationService, "createNotification")
      .mockResolvedValue(null);

    await createMessage({
      channelId,
      senderId,
      content: "This is a reply",
      replyTo: messageId,
    });

    expect(Message.findOne).toHaveBeenCalledWith({
      _id: messageId,
      channel: channelId,
      deletedAt: null,
    });

    expect(Message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        replyTo: messageId,
        content: "This is a reply",
      })
    );
  });

  it("creates mention notifications for valid workspace members", async () => {
    allowChannel();
    mockMessageCreation();

    const notificationSpy = vi.spyOn(
      notificationService,
      "createNotification"
    ).mockResolvedValue(null);

    await createMessage({
      channelId,
      senderId,
      content: "Hello!",
      mentionIds: [
        recipientId,
        senderId,
        "invalid-id",
      ],
    });

    expect(notificationSpy).toHaveBeenCalledTimes(1);

    expect(notificationSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: recipientId,
        sender: senderId,
        type: "mention",
      })
    );
  });

  it("restricts private channel notifications to channel members", async () => {
    const anotherUserId = new mongoose.Types.ObjectId().toString();

    const privateChannel = {
      ...channel,
      type: "private",
      members: [senderId, recipientId],
    };

    const privateWorkspace = {
      members: [
        { userId: senderId },
        { userId: recipientId },
        { userId: anotherUserId },
      ],
    };

    vi.spyOn(Channel, "findById").mockResolvedValue(privateChannel);
    vi.spyOn(Workspace, "findById").mockResolvedValue(privateWorkspace);

    mockMessageCreation();

    const notificationSpy = vi.spyOn(
      notificationService,
      "createNotification"
    ).mockResolvedValue(null);

    await createMessage({
      channelId,
      senderId,
      content: "Private message",
    });

    expect(notificationSpy).toHaveBeenCalledTimes(1);

    expect(notificationSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: recipientId,
        type: "new_message",
      })
    );
  });

  it("does not fail message creation when notification delivery fails", async () => {
    allowChannel();
    mockMessageCreation();

    vi.spyOn(notificationService, "createNotification")
      .mockRejectedValue(new Error("Notification service unavailable"));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await createMessage({
      channelId,
      senderId,
      content: "Message should still succeed",
    });

    expect(result).toBeDefined();
    expect(result._id).toBe(messageId);
    expect(consoleSpy).toHaveBeenCalledWith(
      "Message notification error:",
      "Notification service unavailable"
    );
  });
});



