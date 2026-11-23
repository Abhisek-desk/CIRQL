import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from "../controllers/userSettingsController.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/notifications", getNotificationPreferences);
router.patch("/notifications", updateNotificationPreferences);

export default router;
