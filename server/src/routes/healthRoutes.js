import express from "express";
import mongoose from "mongoose";
import { getRedis } from "../config/redis.js";

const router = express.Router();

router.get("/", async (req, res) => {
  let redisStatus = "not_configured";

  const redis = getRedis();

  if (redis) {
    try {
      await redis.ping();
      redisStatus = "connected";
    } catch {
      redisStatus = "disconnected";
    }
  }

  const mongoStatus =
    mongoose.connection.readyState === 1
      ? "connected"
      : "disconnected";

  const healthy =
    mongoStatus === "connected" &&
    (redisStatus === "connected" ||
      redisStatus === "not_configured");

  res.status(healthy ? 200 : 503).json({
    success: healthy,
    message: "CIRQL API health check",
    timestamp: new Date().toISOString(),
    services: {
      api: "running",
      mongodb: mongoStatus,
      redis: redisStatus,
    },
  });
});

export default router;
