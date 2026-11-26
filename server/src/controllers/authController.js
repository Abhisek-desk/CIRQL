import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { sendPasswordResetEmail } from "../services/emailService.js";
import User from "../models/User.js";

import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
} from "../utils/generateTokens.js";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/api/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const setRefreshCookie = (res, token) => {
  res.cookie("refreshToken", token, cookieOptions);
};

const clearRefreshCookie = (res) => {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth",
  });
};

const createSession = async (user, res) => {
  const accessToken = generateAccessToken(user._id);

  const refreshToken = generateRefreshToken(user._id);

  user.refreshTokenHash = hashToken(refreshToken);

  await user.save();

  setRefreshCookie(res, refreshToken);

  return accessToken;
};

// REGISTER
export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({
      email: email.toLowerCase(),
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email is already registered",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
    });

    const accessToken = await createSession(user, res);

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

// LOGIN
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({
      email: email.toLowerCase(),
    }).select("+passwordHash");

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const passwordMatch = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const accessToken = await createSession(user, res);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

// REFRESH ACCESS TOKEN
export const refresh = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token missing",
      });
    }

    const jwt = await import("jsonwebtoken");

    let decoded;

    try {
      decoded = jwt.default.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET
      );
    } catch {
      clearRefreshCookie(res);

      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token",
      });
    }

    const user = await User.findById(decoded.sub).select(
      "+refreshTokenHash"
    );

    if (
      !user ||
      !user.isActive ||
      !user.refreshTokenHash ||
      user.refreshTokenHash !== hashToken(refreshToken)
    ) {
      if (user) {
        user.refreshTokenHash = null;
        await user.save();
      }

      clearRefreshCookie(res);

      return res.status(401).json({
        success: false,
        message: "Refresh token is no longer valid",
      });
    }

    const accessToken = await createSession(user, res);

    return res.status(200).json({
      success: true,
      accessToken,
    });
  } catch (error) {
    next(error);
  }
};

// LOGOUT
export const logout = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (refreshToken) {
      const jwt = await import("jsonwebtoken");

      try {
        const decoded = jwt.default.verify(
          refreshToken,
          process.env.JWT_REFRESH_SECRET
        );

        const user = await User.findById(decoded.sub).select(
          "+refreshTokenHash"
        );

        if (
          user &&
          user.refreshTokenHash === hashToken(refreshToken)
        ) {
          user.refreshTokenHash = null;
          await user.save();
        }
      } catch {
        // An invalid or expired token can still be cleared.
      }
    }

    clearRefreshCookie(res);

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};

// GET CURRENT USER
export const getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      avatar: req.user.avatar,
      role: req.user.role,
    },
  });
};
// FORGOT PASSWORD
export const forgotPassword = async (req, res, next) => {
  let user;
  let resetTokenHash;

  try {
    const email = req.body.email.trim().toLowerCase();

    user = await User.findOne({
      email,
      isActive: true,
    }).select("+resetPasswordTokenHash +resetPasswordExpiresAt");

    if (user) {
      const resetToken = crypto.randomBytes(32).toString("hex");

      resetTokenHash = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");

      user.resetPasswordTokenHash = resetTokenHash;

      user.resetPasswordExpiresAt = new Date(
        Date.now() + 15 * 60 * 1000
      );

      await user.save();

      const clientUrl = process.env.CLIENT_URL?.replace(/\/+$/, "");

      if (!clientUrl) {
        throw new Error("CLIENT_URL is not configured");
      }

      const resetUrl = `${clientUrl}/reset-password/${resetToken}`;

      await sendPasswordResetEmail({
        email: user.email,
        name: user.name,
        resetUrl,
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "If an account exists with that email, a password reset link has been sent.",
    });
  } catch (error) {
    // Only clear the token created by this request.
    // Never clear a newer token created by another request.
    if (user && resetTokenHash) {
      await User.updateOne(
        {
          _id: user._id,
          resetPasswordTokenHash: resetTokenHash,
        },
        {
          $set: {
            resetPasswordTokenHash: null,
            resetPasswordExpiresAt: null,
          },
        }
      ).catch(() => {});
    }

    next(error);
  }
};

// RESET PASSWORD
export const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const passwordHash = await bcrypt.hash(password, 12);

    // Atomic token consumption:
    // only one request can match and consume this valid token.
    const user = await User.findOneAndUpdate(
      {
        resetPasswordTokenHash: tokenHash,
        resetPasswordExpiresAt: { $gt: new Date() },
        isActive: true,
      },
      {
        $set: {
          passwordHash,
          resetPasswordTokenHash: null,
          resetPasswordExpiresAt: null,
          refreshTokenHash: null,
        },
      },
      {
        new: false,
      }
    );

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "This password reset link is invalid or has expired.",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Password reset successful. Please sign in with your new password.",
    });
  } catch (error) {
    next(error);
  }
};