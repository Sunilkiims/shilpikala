import { describe, it, expect, beforeEach } from "vitest";
import {
  isRateLimited,
  recordAttempt,
  secondsUntilReset,
  __resetRateLimiterForTests,
} from "@/lib/security/rateLimiter";

describe("rateLimiter", () => {
  beforeEach(() => {
    __resetRateLimiterForTests();
  });

  it("is not limited before any attempts are recorded", () => {
    expect(isRateLimited("key-a", 3, 60_000)).toBe(false);
  });

  it("is not limited until the attempt count reaches the limit", () => {
    recordAttempt("key-b", 60_000);
    recordAttempt("key-b", 60_000);
    expect(isRateLimited("key-b", 3, 60_000)).toBe(false);
  });

  it("becomes limited once the count reaches the limit", () => {
    recordAttempt("key-c", 60_000);
    recordAttempt("key-c", 60_000);
    recordAttempt("key-c", 60_000);
    expect(isRateLimited("key-c", 3, 60_000)).toBe(true);
  });

  it("keeps different keys fully independent", () => {
    recordAttempt("key-d", 60_000);
    recordAttempt("key-d", 60_000);
    recordAttempt("key-d", 60_000);
    expect(isRateLimited("key-d", 3, 60_000)).toBe(true);
    expect(isRateLimited("key-e", 3, 60_000)).toBe(false);
  });

  it("resets once the window has genuinely elapsed", async () => {
    const windowMs = 20;
    recordAttempt("key-f", windowMs);
    recordAttempt("key-f", windowMs);
    recordAttempt("key-f", windowMs);
    expect(isRateLimited("key-f", 3, windowMs)).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, windowMs + 10));

    expect(isRateLimited("key-f", 3, windowMs)).toBe(false);
  });

  it("reports a positive seconds-until-reset while limited", () => {
    recordAttempt("key-g", 60_000);
    expect(secondsUntilReset("key-g", 60_000)).toBeGreaterThan(0);
    expect(secondsUntilReset("key-g", 60_000)).toBeLessThanOrEqual(60);
  });

  it("reports zero seconds-until-reset for an untouched key", () => {
    expect(secondsUntilReset("never-touched", 60_000)).toBe(0);
  });
});
