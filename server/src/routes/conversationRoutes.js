import express from "express";

import authMiddleware from "../middleware/authMiddleware.js";

import {
  startConversation,
  getMyConversations,
  getConversation,
  getDirectMessages,
  sendDirectMessage,
  editDirectMessage,
  deleteDirectMessage,
  markConversationRead,
  toggleDirectMessageReaction,
} from "../controllers/conversationController.js";

const router = express.Router();

router.use(authMiddleware);

// Conversation endpoints
router.get("/", getMyConversations);
router.post("/", startConversation);

// Direct message endpoints
router.get("/:conversationId/messages", getDirectMessages);
router.post("/:conversationId/messages", sendDirectMessage);

router.post("/:conversationId/read", markConversationRead);
router.post("/messages/:messageId/reactions", toggleDirectMessageReaction);

// Individual conversation
router.get("/:conversationId", getConversation);

// Individual message
router.patch("/messages/:messageId", editDirectMessage);
router.delete("/messages/:messageId", deleteDirectMessage);

export default router;
