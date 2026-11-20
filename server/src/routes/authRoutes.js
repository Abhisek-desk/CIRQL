import express from "express";

import {
  register,
  login,
  refresh,
  logout,
  getMe,
} from "../controllers/authController.js";

import authMiddleware from "../middleware/authMiddleware.js";
import validateMiddleware from "../middleware/validateMiddleware.js";

import {
  registerSchema,
  loginSchema,
} from "../validators/authValidator.js";

const router = express.Router();

router.post(
  "/register",
  validateMiddleware(registerSchema),
  register
);

router.post(
  "/login",
  validateMiddleware(loginSchema),
  login
);

router.post("/refresh", refresh);

router.post("/logout", logout);

router.get("/me", authMiddleware, getMe);

export default router;