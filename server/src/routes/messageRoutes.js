import express from "express";

import {
  sendMessage,
  getMessages,
  editMessage,
  deleteMessage,
} from "../controllers/messageController.js";

import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authMiddleware);

router.route("/:channelId")
  .get(getMessages)
  .post(sendMessage);

router.patch("/:messageId", editMessage);

router.delete("/:messageId", deleteMessage);

export default router;