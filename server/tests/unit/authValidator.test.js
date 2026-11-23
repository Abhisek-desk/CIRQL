import { describe, it, expect } from "vitest";

import {
  registerSchema,
  loginSchema,
} from "../../src/validators/authValidator.js";

describe("Registration Validation", () => {
  const validUser = {
    name: "Cirql Tester",
    email: "tester@example.com",
    password: "StrongPass@2026",
  };

  it("accepts valid registration data", () => {
    const result = registerSchema.safeParse(validUser);

    expect(result.success).toBe(true);
  });

  it("trims whitespace from the name", () => {
    const result = registerSchema.safeParse({
      ...validUser,
      name: "  Cirql Tester  ",
    });

    expect(result.success).toBe(true);
    expect(result.data.name).toBe("Cirql Tester");
  });

  it("trims whitespace from the email", () => {
    const result = registerSchema.safeParse({
      ...validUser,
      email: "  tester@example.com  ",
    });

    expect(result.success).toBe(true);
    expect(result.data.email).toBe("tester@example.com");
  });

  it("rejects names shorter than 2 characters", () => {
    const result = registerSchema.safeParse({
      ...validUser,
      name: "A",
    });

    expect(result.success).toBe(false);
  });

  it("rejects names longer than 50 characters", () => {
    const result = registerSchema.safeParse({
      ...validUser,
      name: "A".repeat(51),
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid email addresses", () => {
    const result = registerSchema.safeParse({
      ...validUser,
      email: "invalid-email",
    });

    expect(result.success).toBe(false);
  });

  it("rejects passwords shorter than 8 characters", () => {
    const result = registerSchema.safeParse({
      ...validUser,
      password: "short",
    });

    expect(result.success).toBe(false);
  });

  it("rejects passwords longer than 72 characters", () => {
    const result = registerSchema.safeParse({
      ...validUser,
      password: "A".repeat(73),
    });

    expect(result.success).toBe(false);
  });
});

describe("Login Validation", () => {
  it("accepts valid login data", () => {
    const result = loginSchema.safeParse({
      email: "tester@example.com",
      password: "StrongPass@2026",
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid email addresses", () => {
    const result = loginSchema.safeParse({
      email: "invalid-email",
      password: "StrongPass@2026",
    });

    expect(result.success).toBe(false);
  });

  it("rejects empty passwords", () => {
    const result = loginSchema.safeParse({
      email: "tester@example.com",
      password: "",
    });

    expect(result.success).toBe(false);
  });

  it("trims whitespace from login email", () => {
    const result = loginSchema.safeParse({
      email: "  tester@example.com  ",
      password: "StrongPass@2026",
    });

    expect(result.success).toBe(true);
    expect(result.data.email).toBe("tester@example.com");
  });
});
