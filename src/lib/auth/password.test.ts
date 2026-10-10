import { describe, it, expect } from "vitest";
import { hashPassword, validatePassword, verifyPassword } from "@/lib/auth/password";

describe("password hashing", () => {
  it("verifies the right password and rejects a wrong one", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("salts: the same password hashes differently each time", async () => {
    expect(await hashPassword("same-password")).not.toBe(await hashPassword("same-password"));
  });

  it("never stores the plain password", async () => {
    expect(await hashPassword("hunter2hunter2")).not.toContain("hunter2");
  });

  it("rejects a malformed stored hash instead of throwing", async () => {
    expect(await verifyPassword("x", "garbage")).toBe(false);
  });

  it("enforces length limits", () => {
    expect(validatePassword("short")).toBe("password_too_short");
    expect(validatePassword("x".repeat(201))).toBe("password_too_long");
    expect(validatePassword(123)).toBe("invalid_password");
    expect(validatePassword("long enough")).toBeNull();
  });
});
