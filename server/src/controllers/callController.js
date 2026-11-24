import crypto from "crypto";
import mongoose from "mongoose";
import Call from "../models/Call.js";
import Conversation from "../models/Conversation.js";

export const getCallHistory = async (req, res, next) => {
  try {
    const { conversationId } = req.params;

    if (!mongoose.isValidObjectId(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid conversation ID.",
      });
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: req.user._id,
    });

    if (!conversation || conversation.participants.length !== 2) {
      return res.status(403).json({
        success: false,
        message: "Conversation access denied.",
      });
    }

    const requestedLimit = Number.parseInt(req.query.limit, 10) || 30;
    const limit = Math.min(Math.max(requestedLimit, 1), 50);

    const calls = await Call.find({
      conversation: conversationId,
      $or: [
        { caller: req.user._id },
        { callee: req.user._id },
      ],
    })
      .populate("caller", "name avatar")
      .populate("callee", "name avatar")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.json({
      success: true,
      calls,
    });
  } catch (error) {
    next(error);
  }
};

export const getIceServers = async (req, res, next) => {
  try {
    const meteredAppUrl = process.env.METERED_APP_URL?.replace(/\/+$/, "");
    const meteredApiKey = process.env.METERED_API_KEY;

    if (meteredAppUrl && meteredApiKey) {
      const endpoint = new URL(
        `${meteredAppUrl}/api/v1/turn/credentials`
      );

      endpoint.searchParams.set("apiKey", meteredApiKey);

      const response = await fetch(endpoint, {
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        console.error("Metered TURN credential request failed:", response.status);
        return res.status(502).json({
          success: false,
          message: "Unable to retrieve TURN credentials.",
        });
      }

      const iceServers = await response.json();

      if (!Array.isArray(iceServers) || iceServers.length === 0) {
        return res.status(502).json({
          success: false,
          message: "Invalid TURN credentials response.",
        });
      }

      return res.json({
        success: true,
        turnConfigured: true,
        iceServers,
      });
    }

    const iceServers = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ];

    const turnUrl = process.env.TURN_URL;
    const turnSecret = process.env.TURN_SECRET;

    if (!turnUrl || !turnSecret) {
      return res.json({
        success: true,
        turnConfigured: false,
        iceServers,
      });
    }

    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    const username = `${expiresAt}:${req.user._id}`;

    const credential = crypto
      .createHmac("sha1", turnSecret)
      .update(username)
      .digest("base64");

    const urls = turnUrl
      .split(",")
      .map((url) => url.trim())
      .filter(Boolean);

    iceServers.push({
      urls,
      username,
      credential,
    });

    return res.json({
      success: true,
      turnConfigured: true,
      iceServers,
    });
  } catch (error) {
    next(error);
  }
};
