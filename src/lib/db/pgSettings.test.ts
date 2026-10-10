import { describe, it, expect } from "vitest";
import { buildPgSettings } from "@/lib/db/client";

const neon = "postgresql://user:pw@ep-cool-123-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

describe("buildPgSettings", () => {
  it("replaces sslmode=require with an explicit, verifying ssl option", () => {
    const s = buildPgSettings(neon, undefined);
    expect(s.connectionString).not.toContain("sslmode");
    expect(s.ssl).toEqual({ rejectUnauthorized: true });
  });

  it("keeps other URL parameters", () => {
    const s = buildPgSettings(neon + "&application_name=shop", undefined);
    expect(s.connectionString).toContain("application_name=shop");
  });

  it("DATABASE_SSL=true turns SSL on for a URL without sslmode", () => {
    expect(buildPgSettings("postgres://u:p@h/db", "true").ssl).toEqual({ rejectUnauthorized: true });
  });

  it("DATABASE_SSL=no-verify skips certificate verification (self-signed hosts)", () => {
    expect(buildPgSettings("postgres://u:p@h/db", "no-verify").ssl).toEqual({ rejectUnauthorized: false });
  });

  it("no SSL for a plain local URL, and DATABASE_SSL=false wins over the URL", () => {
    expect(buildPgSettings("postgres://u:p@localhost/db", undefined).ssl).toBe(false);
    expect(buildPgSettings(neon, "false").ssl).toBe(false);
  });

  it("sslmode=disable stays off", () => {
    expect(buildPgSettings("postgres://u:p@h/db?sslmode=disable", undefined).ssl).toBe(false);
  });

  it("does not throw on an unparseable URL", () => {
    expect(() => buildPgSettings("not a url", "true")).not.toThrow();
  });
});
