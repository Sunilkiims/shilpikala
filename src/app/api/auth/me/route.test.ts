import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isolateStorageDir } from "@/test-support/tempStorageDir";

let cleanup: () => void;
beforeEach(() => { cleanup = isolateStorageDir(); });
afterEach(() => cleanup());

describe("GET /api/auth/me", () => {
  it("returns a null customer, uncacheable, when signed out", async () => {
    const { GET } = await import("@/app/api/auth/me/route");
    const response = await GET(new Request("http://localhost/api/auth/me"));
    expect(await response.json()).toEqual({ customer: null });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("ignores a bogus session cookie", async () => {
    const { GET } = await import("@/app/api/auth/me/route");
    const response = await GET(new Request("http://localhost/api/auth/me", { headers: { cookie: "sk_session=nope" } }));
    expect(await response.json()).toEqual({ customer: null });
  });
});
