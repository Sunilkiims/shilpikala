import { describe, it, expect } from "vitest";
import { isValidEmail } from "@/lib/utils/email";

describe("isValidEmail", () => {
  it("accepts ordinary addresses", () => {
    expect(isValidEmail("jane@example.com")).toBe(true);
    expect(isValidEmail("first.last+tag@sub.example.co.in")).toBe(true);
  });

  it("rejects missing @ or domain", () => {
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("jane@")).toBe(false);
    expect(isValidEmail("@example.com")).toBe(false);
  });

  it("rejects whitespace and non-string input", () => {
    expect(isValidEmail("jane @example.com")).toBe(false);
    expect(isValidEmail(undefined)).toBe(false);
    expect(isValidEmail(123)).toBe(false);
    expect(isValidEmail(null)).toBe(false);
  });
});
