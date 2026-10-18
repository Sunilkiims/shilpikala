import { describe, expect, it } from "vitest";
import {
  describeDatabaseTarget,
  explainDatabaseFailure,
  hintForDatabaseError,
} from "@/lib/db/diagnose";

const pgErr = (message: string, code?: string) =>
  Object.assign(new Error(message), code ? { code } : {});

describe("describeDatabaseTarget", () => {
  it("never includes the user name or password", () => {
    const t = describeDatabaseTarget(
      "postgres://user:s3cret@db.example.com:5432/shop?sslmode=require",
    );
    expect(t).toBe("db.example.com:5432/shop");
    expect(t).not.toContain("s3cret");
    expect(t).not.toContain("user");
  });
  it("copes with a missing or invalid URL", () => {
    expect(describeDatabaseTarget(undefined)).toBe("embedded database");
    expect(describeDatabaseTarget("not a url")).toContain("not a valid URL");
  });
});

describe("hintForDatabaseError", () => {
  it.each([
    ["Tenant or user not found", "postgres.<project-ref>"],
    ['password authentication failed for user "x"', "URL-encoded"],
    ["getaddrinfo ENOTFOUND db.nope.example", "host name"],
    ["connect ECONNREFUSED 10.0.0.1:5432", "could not be reached"],
    ["The server does not support SSL connections", "DATABASE_SSL"],
    ["remaining connection slots are reserved", "connection limit"],
    ["MaxClientsInSessionMode: max clients reached", "connection limit"],
    ["permission denied for schema public", "create tables"],
    ['relation "offers" does not exist', "db:check"],
  ])("explains %s", (message, expected) => {
    expect(hintForDatabaseError(pgErr(message))).toContain(expected);
  });
  it("gives no hint for an unknown error", () => {
    expect(hintForDatabaseError(pgErr("something odd"))).toBeUndefined();
  });
});

describe("explainDatabaseFailure", () => {
  it("keeps the original message, names the migration and host, and keeps the cause", () => {
    const original = Object.assign(
      pgErr('column "x" already exists', "42701"),
      { migrationId: "008_offers" },
    );
    const wrapped = explainDatabaseFailure(
      original,
      "postgres://u:pw@db.example.com:5432/shop",
    );
    expect(wrapped.message).toContain("migration 008_offers");
    expect(wrapped.message).toContain("db.example.com:5432/shop");
    expect(wrapped.message).toContain('column "x" already exists');
    expect(wrapped.message).toContain("42701");
    expect(wrapped.message).not.toContain("pw@");
    expect(wrapped.cause).toBe(original);
  });
  it("handles non-Error throws", () => {
    expect(explainDatabaseFailure("boom", undefined).message).toContain("boom");
  });
});
