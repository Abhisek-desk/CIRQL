import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
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
      .post("/api/auth/logout")
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
});

