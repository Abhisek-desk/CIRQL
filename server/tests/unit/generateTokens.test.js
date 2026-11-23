import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";

import {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
} from "../../src/utils/generateTokens.js";

describe("Token Generation", () => {
  const userId = "6b0450880b78331db781c7b1";

  it("generates a valid access token", () => {
    const token = generateAccessToken(userId);

    const decoded = jwt.verify(
      token,
      process.env.JWT_ACCESS_SECRET
    );

    expect(decoded.sub).toBe(userId);
  });

  it("sets access token expiration to 15 minutes", () => {
    const token = generateAccessToken(userId);

    const decoded = jwt.decode(token);

    expect(decoded.exp - decoded.iat).toBe(900);
  });

  it("generates a valid refresh token", () => {
    const token = generateRefreshToken(userId);

    const decoded = jwt.verify(
      token,
      process.env.JWT_REFRESH_SECRET
    );

    expect(decoded.sub).toBe(userId);
    expect(decoded.jti).toBeDefined();
  });

  it("generates a unique refresh token ID", () => {
    const first = jwt.decode(generateRefreshToken(userId));
    const second = jwt.decode(generateRefreshToken(userId));

    expect(first.jti).not.toBe(second.jti);
  });

  it("sets refresh token expiration to 7 days", () => {
    const token = generateRefreshToken(userId);

    const decoded = jwt.decode(token);

    expect(decoded.exp - decoded.iat).toBe(604800);
  });

  it("generates a SHA-256 token hash", () => {
    const hash = hashToken("cirql-test-token");

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("generates the same hash for the same token", () => {
    const first = hashToken("cirql-test-token");
    const second = hashToken("cirql-test-token");

    expect(first).toBe(second);
  });

  it("generates different hashes for different tokens", () => {
    expect(hashToken("token-one")).not.toBe(
      hashToken("token-two")
    );
  });
});
