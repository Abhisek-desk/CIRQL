import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  updateCustomStatus,
  clearCustomStatus,
} from "../controllers/presenceController.js";

const router = express.Router();

router.use(authMiddleware);

router.put("/status", updateCustomStatus);
router.delete("/status", clearCustomStatus);

export default router;
