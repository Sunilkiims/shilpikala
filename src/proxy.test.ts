import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { basicAuthHeader } from "@/test-support/request";

let proxy: (request: NextRequest) => Response;

function adminRequest(options: { auth?: string; ip?: string; path?: string } = {}) {
  const { auth, ip = "198.51.100.1", path = "/admin/orders" } = options;
  const headers: Record<string, string> = { "x-forwarded-for": ip };
  if (auth) headers.authorization = auth;
  return new NextRequest(`http://localhost${path}`, { headers });
}

async function load(env: { configured: boolean }) {
  vi.resetModules();
  vi.stubEnv("ADMIN_USERNAME", env.configured ? "admin" : "");
  vi.stubEnv("ADMIN_PASSWORD", env.configured ? "s3cret-pass" : "");
  ({ proxy } = await import("@/proxy"));
}

const good = basicAuthHeader("admin", "s3cret-pass");
const bad = (n: number) => basicAuthHeader("admin", `wrong-${n}`);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("admin proxy — when credentials aren't configured", () => {
  beforeEach(() => load({ configured: false }));

  it("fails closed with 503 rather than leaving /admin open", () => {
    const response = proxy(adminRequest({ auth: good }));
    expect(response.status).toBe(503);
  });
});

describe("admin proxy — authentication", () => {
  beforeEach(() => load({ configured: true }));

  it("challenges a request with no credentials (401 + WWW-Authenticate)", () => {
    const response = proxy(adminRequest());
    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toContain("Basic");
  });

  it("rejects a wrong password", () => {
    expect(proxy(adminRequest({ auth: bad(1) })).status).toBe(401);
  });

  it("rejects a wrong username", () => {
    expect(proxy(adminRequest({ auth: basicAuthHeader("root", "s3cret-pass") })).status).toBe(401);
  });

  it("rejects a malformed Authorization header", () => {
    expect(proxy(adminRequest({ auth: "Basic !!!not-base64!!!" })).status).toBe(401);
    expect(proxy(adminRequest({ auth: "Bearer sometoken" })).status).toBe(401);
  });

  it("lets correct credentials through to the app", () => {
    const response = proxy(adminRequest({ auth: good }));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("accepts a password that itself contains a colon", () => {
    // Basic auth splits on the FIRST colon only.
    vi.resetModules();
    vi.stubEnv("ADMIN_PASSWORD", "pass:with:colons");
    return import("@/proxy").then(({ proxy: freshProxy }) => {
      const response = freshProxy(
        adminRequest({ auth: basicAuthHeader("admin", "pass:with:colons"), ip: "198.51.100.50" })
      );
      expect(response.headers.get("x-middleware-next")).toBe("1");
    });
  });
});

describe("admin proxy — brute-force lockout", () => {
  beforeEach(() => load({ configured: true }));

  it("locks an IP out after 10 failed attempts, even for the correct password", () => {
    const ip = "198.51.100.10";
    for (let i = 0; i < 10; i += 1) {
      expect(proxy(adminRequest({ auth: bad(i), ip })).status).toBe(401);
    }

    const locked = proxy(adminRequest({ auth: good, ip }));
    expect(locked.status).toBe(429);
    expect(Number(locked.headers.get("Retry-After"))).toBeGreaterThan(0);
  });

  it("does not count credential-less requests (the browser's normal first request) as failures", () => {
    const ip = "198.51.100.11";
    for (let i = 0; i < 25; i += 1) {
      expect(proxy(adminRequest({ ip })).status).toBe(401);
    }

    expect(proxy(adminRequest({ auth: good, ip })).headers.get("x-middleware-next")).toBe("1");
  });

  it("does not count successful logins against the budget", () => {
    const ip = "198.51.100.12";
    for (let i = 0; i < 30; i += 1) {
      expect(proxy(adminRequest({ auth: good, ip })).headers.get("x-middleware-next")).toBe("1");
    }
  });

  it("counts a malformed credential header as a failed attempt", () => {
    const ip = "198.51.100.13";
    for (let i = 0; i < 10; i += 1) {
      proxy(adminRequest({ auth: "Basic !!!not-base64!!!", ip }));
    }
    expect(proxy(adminRequest({ auth: good, ip })).status).toBe(429);
  });

  it("keeps lockouts independent per IP", () => {
    for (let i = 0; i < 10; i += 1) {
      proxy(adminRequest({ auth: bad(i), ip: "198.51.100.14" }));
    }

    const otherIp = proxy(adminRequest({ auth: good, ip: "198.51.100.15" }));
    expect(otherIp.headers.get("x-middleware-next")).toBe("1");
  });

  it("applies the same protection to the admin API routes", () => {
    const response = proxy(adminRequest({ path: "/api/admin/products", ip: "198.51.100.16" }));
    expect(response.status).toBe(401);
  });
});
