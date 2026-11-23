import express from "express";

import authMiddleware from "../middleware/authMiddleware.js";

import {
  startConversation,
  getMyConversations,
  getConversation,
} from "../controllers/conversationController.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", getMyConversations);

router.post("/", startConversation);

router.get("/:conversationId", getConversation);

export default router;