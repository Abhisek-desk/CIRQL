import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { toggleReaction } from "../controllers/reactionController.js";

const router = express.Router();

router.use(authMiddleware);

router.post("/:messageId", toggleReaction);

export default router;