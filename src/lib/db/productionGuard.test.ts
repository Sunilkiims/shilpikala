import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isolateStorageDir } from "@/test-support/tempStorageDir";

let cleanup: () => void;
beforeEach(() => { cleanup = isolateStorageDir(); });
afterEach(() => { vi.unstubAllEnvs(); cleanup(); });

describe("production database guard", () => {
  it("refuses to boot in production without DATABASE_URL", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "");
    const { getDb } = await import("@/lib/db");
    await expect(getDb()).rejects.toThrow(/DATABASE_URL is not set/);
  });

  it("recovers once the variable is provided (a failed boot is not cached)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "");
    const { getDb } = await import("@/lib/db");
    await expect(getDb()).rejects.toThrow();
    vi.stubEnv("ALLOW_EMBEDDED_DB", "true");
    vi.stubEnv("PGLITE_DATA_DIR", path.join(mkdtempSync(path.join(tmpdir(), "pgl-")), "data"));
    await expect(getDb()).resolves.toBeDefined();
  });
});

describe("emailLink", () => {
  it("builds links from NEXT_PUBLIC_SITE_URL, never from request data", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.example.com/");
    const { emailLink } = await import("@/lib/config/emailLinks");
    expect(emailLink("/account/reset-password?token=abc")).toBe(
      "https://shop.example.com/account/reset-password?token=abc"
    );
  });
});
