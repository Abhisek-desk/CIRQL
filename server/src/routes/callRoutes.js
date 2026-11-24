import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  getCallHistory,
  getIceServers,
} from "../controllers/callController.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/ice-servers", getIceServers);
router.get("/history/:conversationId", getCallHistory);

export default router;
