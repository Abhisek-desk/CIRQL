import express from "express";

import {
  register,
  login,
  refresh,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
} from "../controllers/authController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import validateMiddleware from "../middleware/validateMiddleware.js";

import {
  loginLimiter,
  registerLimiter,
  refreshLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
} from "../middleware/authRateLimit.js";

import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../validators/authValidator.js";

const router = express.Router();

router.post(
  "/register",
  registerLimiter,
  validateMiddleware(registerSchema),
  register
);

router.post(
  "/login",
  loginLimiter,
  validateMiddleware(loginSchema),
  login
);

router.post(
  "/refresh",
  refreshLimiter,
  refresh
);

router.post("/logout", logout);

router.get("/me", authMiddleware, getMe);

router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  validateMiddleware(forgotPasswordSchema),
  forgotPassword
);

router.post(
  "/reset-password",
  resetPasswordLimiter,
  validateMiddleware(resetPasswordSchema),
  resetPassword
);

export default router;