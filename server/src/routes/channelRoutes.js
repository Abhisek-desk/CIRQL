import express from "express";

import {
  createChannel,
  getWorkspaceChannels,
  getChannel,
  deleteChannel,
} from "../controllers/channelController.js";

import authMiddleware from "../middleware/authMiddleware.js";

import {
  requireWorkspaceMember,
} from "../middleware/workspaceMiddleware.js";

const router = express.Router();

router.use(authMiddleware);

router.post(
  "/:workspaceId",
  requireWorkspaceMember,
  createChannel
);

router.get(
  "/:workspaceId",
  requireWorkspaceMember,
  getWorkspaceChannels
);

router.get(
  "/:workspaceId/:channelId",
  requireWorkspaceMember,
  getChannel
);

router.delete(
  "/:workspaceId/:channelId",
  requireWorkspaceMember,
  deleteChannel
);

export default router;