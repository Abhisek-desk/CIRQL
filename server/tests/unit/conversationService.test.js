import { describe, it, expect, vi } from "vitest";

import Conversation from "../../src/models/Conversation.js";
import User from "../../src/models/User.js";

import {
  getParticipantKey,
  getAccessibleConversation,
  createOrGetConversation,
} from "../../src/services/conversationService.js";

describe("Conversation Service", () => {
  const userId = "6b0450880b78331db781c7b1";
  const recipientId = "6b0450880b78331db781c7b2";
  const conversationId = "6b0450880b78331db781c7b3";

  describe("getParticipantKey", () => {
    it("creates a consistent key regardless of participant order", () => {
      expect(getParticipantKey(userId, recipientId)).toBe(
        getParticipantKey(recipientId, userId)
      );
    });

    it("creates different keys for different participants", () => {
      const anotherId = "6b0450880b78331db781c7b4";

      expect(getParticipantKey(userId, recipientId)).not.toBe(
        getParticipantKey(userId, anotherId)
      );
    });

    it("returns a string containing both participant IDs", () => {
      const key = getParticipantKey(userId, recipientId);

      expect(typeof key).toBe("string");
      expect(key).toContain(userId);
      expect(key).toContain(recipientId);
    });
  });

  describe("getAccessibleConversation", () => {
    it("rejects invalid conversation IDs without querying MongoDB", async () => {
      const findSpy = vi.spyOn(Conversation, "findOne");

      const result = await getAccessibleConversation("invalid-id", userId);

      expect(result).toBeNull();
      expect(findSpy).not.toHaveBeenCalled();

      findSpy.mockRestore();
    });

    it("queries using conversation ID and participant ID", async () => {
      const mockConversation = { _id: conversationId };

      const findSpy = vi
        .spyOn(Conversation, "findOne")
        .mockResolvedValue(mockConversation);

      const result = await getAccessibleConversation(conversationId, userId);

      expect(result).toBe(mockConversation);
      expect(findSpy).toHaveBeenCalledWith({
        _id: conversationId,
        participants: userId,
      });

      findSpy.mockRestore();
    });

    it("returns null when the user is not an authorized participant", async () => {
      const findSpy = vi
        .spyOn(Conversation, "findOne")
        .mockResolvedValue(null);

      const result = await getAccessibleConversation(
        conversationId,
        recipientId
      );

      expect(result).toBeNull();

      findSpy.mockRestore();
    });
  });

  describe("createOrGetConversation", () => {
    it("rejects an invalid recipient ID", async () => {
      await expect(
        createOrGetConversation(userId, "invalid-id")
      ).rejects.toThrow("Invalid recipient ID");
    });

    it("prevents users from messaging themselves", async () => {
      await expect(
        createOrGetConversation(userId, userId)
      ).rejects.toThrow(
        "You cannot start a conversation with yourself"
      );
    });

    it("rejects missing or inactive recipients", async () => {
      const selectMock = vi.fn().mockResolvedValue(null);

      const findSpy = vi
        .spyOn(User, "findOne")
        .mockReturnValue({ select: selectMock });

      await expect(
        createOrGetConversation(userId, recipientId)
      ).rejects.toThrow("User not found or inactive");

      expect(findSpy).toHaveBeenCalledWith({
        _id: recipientId,
        isActive: true,
      });

      findSpy.mockRestore();
    });
  });
});
