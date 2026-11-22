import express from "express";

import {
  createWorkspace,
  getMyWorkspaces,
  getWorkspace,
  updateWorkspace,
  addWorkspaceMember,
  deleteWorkspace,
  getWorkspaceMembers
} from "../controllers/workspaceController.js";

import authMiddleware from "../middleware/authMiddleware.js";

import {
  requireWorkspaceMember,
  requireWorkspaceAdmin,
} from "../middleware/workspaceMiddleware.js";

const router = express.Router();

router.use(authMiddleware);

router.post("/", createWorkspace);

router.get("/", getMyWorkspaces);

router.get(
  "/:workspaceId",
  requireWorkspaceMember,
  getWorkspace
);

router.get(
  "/:workspaceId/members",
  requireWorkspaceMember,
  getWorkspaceMembers
);

router.patch(
  "/:workspaceId",
  requireWorkspaceMember,
  requireWorkspaceAdmin,
  updateWorkspace
);

router.post(
  "/:workspaceId/members",
  requireWorkspaceMember,
  requireWorkspaceAdmin,
  addWorkspaceMember
);

router.delete(
  "/:workspaceId",
  requireWorkspaceMember,
  requireWorkspaceAdmin,
  deleteWorkspace
);

export default router;