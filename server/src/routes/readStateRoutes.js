import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";

import {
  getUnreadCounts,
  getChannelReadReceipts,
  markChannelAsRead,
} from "../controllers/readStateController.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/workspace/:workspaceId", getUnreadCounts);
router.get("/:channelId/receipts", getChannelReadReceipts);
router.post("/:channelId/read", markChannelAsRead);

export default router;

