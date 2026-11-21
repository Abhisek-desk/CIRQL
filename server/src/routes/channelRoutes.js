import express from "express";

import {
  createChannel,
  getWorkspaceChannels,
  getChannel,
  deleteChannel,
  addPrivateChannelMember,
} from "../controllers/channelController.js";

import authMiddleware from "../middleware/authMiddleware.js";

import {
  requireWorkspaceMember,
  requireWorkspaceAdmin,
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

router.post(
  "/:workspaceId/:channelId/members",
  requireWorkspaceMember,
  requireWorkspaceAdmin,
  addPrivateChannelMember
);

export default router;