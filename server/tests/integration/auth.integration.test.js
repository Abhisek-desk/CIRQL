import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import crypto from "node:crypto";

vi.mock("../../src/services/emailService.js", () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

import { sendPasswordResetEmail } from "../../src/services/emailService.js";
import bcrypt from "bcryptjs";
import { MongoMemoryServer } from "mongodb-memory-server";

import { app, request } from "../helpers/testApp.js";
import User from "../../src/models/User.js";

let mongoServer;

const testUser = {
  name: "CIRQL Tester",
  email: "auth.integration@example.com",
  password: "SecurePassword123",
};

const getCookie = (response) => {
  const cookies = response.headers["set-cookie"] || [];
  const cookie = cookies.find((item) =>
    item.startsWith("refreshToken=")
  );

  return cookie?.split(";")[0];
};

describe("Authentication Integration Tests", () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create({
      binary: { version: "7.0.14" },
    });

    await mongoose.connect(mongoServer.getUri());
  }, 300000);

  afterAll(async () => {
    await mongoose.disconnect();

    if (mongoServer) {
      await mongoServer.stop();
    }
  }, 30000);

  beforeEach(async () => {
    await User.deleteMany({});
    vi.clearAllMocks();
  });

  it("registers a new user and creates a session", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send(testUser);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.accessToken).toBeTruthy();
    expect(response.body.user.email).toBe(testUser.email);
    expect(response.headers["set-cookie"]).toBeDefined();

    const user = await User.findOne({ email: testUser.email })
      .select("+passwordHash +refreshTokenHash");

    expect(user).toBeTruthy();
    expect(user.passwordHash).not.toBe(testUser.password);
    expect(user.refreshTokenHash).toBeTruthy();
  });

  it("rejects duplicate registration", async () => {
    await request(app)
      .post("/api/auth/register")
      .send(testUser);

    const response = await request(app)
      .post("/api/auth/register")
      .send(testUser);

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });

  it("rejects invalid registration data", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        name: "A",
        email: "invalid-email",
        password: "123",
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("logs in an existing user", async () => {
    await request(app)
      .post("/api/auth/register")
      .send(testUser);

    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: testUser.email,
        password: testUser.password,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.accessToken).toBeTruthy();
    expect(response.headers["set-cookie"]).toBeDefined();
  });

  it("rejects incorrect login credentials", async () => {
    await request(app)
      .post("/api/auth/register")
      .send(testUser);

    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: testUser.email,
        password: "WrongPassword123",
      });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("rejects login for an inactive account", async () => {
    const passwordHash = await bcrypt.hash(testUser.password, 12);

    await User.create({
      ...testUser,
      passwordHash,
      isActive: false,
    });

    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: testUser.email,
        password: testUser.password,
      });

    expect(response.status).toBe(401);
  });

  it("rejects access to /me without a token", async () => {
    const response = await request(app)
      .get("/api/auth/me");

    expect(response.status).toBe(401);
  });

  it("returns the authenticated user from /me", async () => {
    const login = await request(app)
      .post("/api/auth/register")
      .send(testUser);

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${login.body.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.user.email).toBe(testUser.email);
  });

  it("rejects an invalid access token", async () => {
    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer invalid.token.value");

    expect(response.status).toBe(401);
  });

  it("rejects refresh when the cookie is missing", async () => {
    const response = await request(app)
      .post("/api/auth/refresh");

    expect(response.status).toBe(401);
  });

  it("rotates refresh tokens and rejects reuse of the old token", async () => {
    const login = await request(app)
      .post("/api/auth/register")
      .send(testUser);

    const oldCookie = getCookie(login);

    expect(oldCookie).toBeTruthy();

    const refresh = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", oldCookie);

    expect(refresh.status).toBe(200);
    expect(refresh.body.accessToken).toBeTruthy();

    const newCookie = getCookie(refresh);

    expect(newCookie).toBeTruthy();
    expect(newCookie).not.toBe(oldCookie);

    const replay = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", oldCookie);

    expect(replay.status).toBe(401);

    const user = await User.findOne({ email: testUser.email })
      .select("+refreshTokenHash");

    expect(user.refreshTokenHash).toBeNull();

    const newTokenAfterReplay = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", newCookie);

    expect(newTokenAfterReplay.status).toBe(401);
  });

  it("logs out and invalidates the refresh token", async () => {
    const login = await request(app)
      .post("/api/auth/register")
      .send(testUser);

    const cookie = getCookie(login);

    const logout = await request(app)
      .post("/api/auth/")
      .set("Cookie", cookie);

    expect(logout.status).toBe(200);
    expect(logout.body.success).toBe(true);

    const user = await User.findOne({ email: testUser.email })
      .select("+refreshTokenHash");

    expect(user.refreshTokenHash).toBeNull();

    const refresh = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookie);

    expect(refresh.status).toBe(401);
  });
  // ========================================================
  // PASSWORD RESET TESTS
  // ========================================================

  const createTestAccount = async () => {
    const passwordHash = await bcrypt.hash(testUser.password, 12);

    return User.create({
      ...testUser,
      passwordHash,
    });
  };

  const requestPasswordReset = async () => {
    const response = await request(app)
      .post("/api/auth/forgot-password")
      .send({
        email: testUser.email,
      });

    return response;
  };

  const getResetTokenFromEmail = () => {
    const emailArguments =
      sendPasswordResetEmail.mock.calls[0]?.[0];

    if (!emailArguments?.resetUrl) {
      throw new Error("Mock reset email was not generated.");
    }

    return new URL(emailArguments.resetUrl).pathname.split("/").pop();
  };

  it("sends a reset email and stores only the hashed reset token", async () => {
    await createTestAccount();

    const beforeRequest = Date.now();

    const response = await requestPasswordReset();

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(response.body.message).toBe(
      "If an account exists with that email, a password reset link has been sent."
    );

    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);

    const resetToken = getResetTokenFromEmail();

    expect(resetToken).toMatch(/^[a-f0-9]{64}$/);

    const expectedHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    const user = await User.findOne({
      email: testUser.email,
    }).select("+resetPasswordTokenHash +resetPasswordExpiresAt");

    expect(user.resetPasswordTokenHash).toBe(expectedHash);
    expect(user.resetPasswordTokenHash).not.toBe(resetToken);

    expect(user.resetPasswordExpiresAt.getTime()).toBeGreaterThan(
      beforeRequest + 14 * 60 * 1000
    );

    expect(user.resetPasswordExpiresAt.getTime()).toBeLessThanOrEqual(
      Date.now() + 15 * 60 * 1000
    );
  });

  it("returns the same generic response for an unknown email", async () => {
    const unknownResponse = await request(app)
      .post("/api/auth/forgot-password")
      .send({
        email: "unknown@example.com",
      });

    expect(unknownResponse.status).toBe(200);
    expect(unknownResponse.body.success).toBe(true);

    expect(sendPasswordResetEmail).not.toHaveBeenCalled();

    await createTestAccount();

    const knownResponse = await requestPasswordReset();

    expect(knownResponse.status).toBe(200);

    expect(knownResponse.body.message).toBe(
      unknownResponse.body.message
    );
  });

  it("rejects invalid and expired reset tokens", async () => {
    const user = await createTestAccount();

    const expiredToken = "expired-test-reset-token";

    const expiredTokenHash = crypto
      .createHash("sha256")
      .update(expiredToken)
      .digest("hex");

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          resetPasswordTokenHash: expiredTokenHash,
          resetPasswordExpiresAt: new Date(Date.now() - 1000),
        },
      }
    );

    const invalidResponse = await request(app)
      .post("/api/auth/reset-password")
      .send({
        token: "completely-invalid-token",
        password: "NewSecurePassword456",
      });

    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body.success).toBe(false);

    const expiredResponse = await request(app)
      .post("/api/auth/reset-password")
      .send({
        token: expiredToken,
        password: "NewSecurePassword456",
      });

    expect(expiredResponse.status).toBe(400);
    expect(expiredResponse.body.success).toBe(false);
  });

  it("resets the password, consumes the token and invalidates the old session", async () => {
    const registration = await request(app)
      .post("/api/auth/register")
      .send(testUser);

    expect(registration.status).toBe(201);

    const oldRefreshCookie = getCookie(registration);

    expect(oldRefreshCookie).toBeTruthy();

    const forgotResponse = await requestPasswordReset();

    expect(forgotResponse.status).toBe(200);

    const resetToken = getResetTokenFromEmail();

    const newPassword = "NewSecurePassword456";

    const resetResponse = await request(app)
      .post("/api/auth/reset-password")
      .send({
        token: resetToken,
        password: newPassword,
      });

    expect(resetResponse.status).toBe(200);
    expect(resetResponse.body.success).toBe(true);

    const user = await User.findOne({
      email: testUser.email,
    }).select(
      "+passwordHash +refreshTokenHash +resetPasswordTokenHash +resetPasswordExpiresAt"
    );

    expect(user.passwordHash).not.toBe(newPassword);
    expect(await bcrypt.compare(newPassword, user.passwordHash)).toBe(true);

    expect(user.refreshTokenHash).toBeNull();
    expect(user.resetPasswordTokenHash).toBeNull();
    expect(user.resetPasswordExpiresAt).toBeNull();

    const reusedTokenResponse = await request(app)
      .post("/api/auth/reset-password")
      .send({
        token: resetToken,
        password: "AnotherSecurePassword789",
      });

    expect(reusedTokenResponse.status).toBe(400);

    const oldLogin = await request(app)
      .post("/api/auth/login")
      .send({
        email: testUser.email,
        password: testUser.password,
      });

    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post("/api/auth/login")
      .send({
        email: testUser.email,
        password: newPassword,
      });

    expect(newLogin.status).toBe(200);
    expect(newLogin.body.success).toBe(true);

    const oldRefreshResponse = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", oldRefreshCookie);

    expect(oldRefreshResponse.status).toBe(401);
  });

  it("allows only one of two concurrent requests to consume a reset token", async () => {
    await createTestAccount();

    await requestPasswordReset();

    const resetToken = getResetTokenFromEmail();

    const [firstResponse, secondResponse] = await Promise.all([
      request(app)
        .post("/api/auth/reset-password")
        .send({
          token: resetToken,
          password: "FirstSecurePassword456",
        }),

      request(app)
        .post("/api/auth/reset-password")
        .send({
          token: resetToken,
          password: "SecondSecurePassword456",
        }),
    ]);

    const statuses = [
      firstResponse.status,
      secondResponse.status,
    ].sort();

    expect(statuses).toEqual([200, 400]);

    const user = await User.findOne({
      email: testUser.email,
    }).select("+passwordHash");

    const firstPasswordMatches = await bcrypt.compare(
      "FirstSecurePassword456",
      user.passwordHash
    );

    const secondPasswordMatches = await bcrypt.compare(
      "SecondSecurePassword456",
      user.passwordHash
    );

    expect(
      Number(firstPasswordMatches) + Number(secondPasswordMatches)
    ).toBe(1);
  });
});

