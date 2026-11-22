import express from "express";

import {
  sendMessage,
  getMessages,
  editMessage,
  deleteMessage,
  searchMessages,
} from "../controllers/messageController.js";

import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/:channelId/search", searchMessages);

router.route("/:channelId")
  .get(getMessages)
  .post(sendMessage);

router.patch("/:messageId", editMessage);

router.delete("/:messageId", deleteMessage);

export default router;
