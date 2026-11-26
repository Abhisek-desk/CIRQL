import rateLimit from "express-rate-limit";

const createAuthLimiter = (windowMs, limit, message) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,

    // Keep automated integration tests independent.
    skip: () => process.env.NODE_ENV === "test",

    message: {
      success: false,
      message,
    },
  });

export const loginLimiter = createAuthLimiter(
  15 * 60 * 1000,
  10,
  "Too many login attempts. Please try again after 15 minutes."
);

export const registerLimiter = createAuthLimiter(
  60 * 60 * 1000,
  10,
  "Too many registration attempts. Please try again later."
);

export const refreshLimiter = createAuthLimiter(
  15 * 60 * 1000,
  30,
  "Too many refresh attempts. Please try again later."
);
export const forgotPasswordLimiter = createAuthLimiter(
  15 * 60 * 1000,
  5,
  "Too many password reset requests. Please try again later."
);

export const resetPasswordLimiter = createAuthLimiter(
  15 * 60 * 1000,
  10,
  "Too many password reset attempts. Please try again later."
);