import { describe, it, expect, afterEach, vi } from "vitest";

const senders = [
  { kind: "orders", from: "ShilpiKala Orders <orders@shilpikala.com>" },
  { kind: "invoice", from: "ShilpiKala Invoices <invoice@shilpikala.com>" },
  { kind: "account", from: "ShilpiKala Account <account@other.example>" },
  { kind: "general", from: "" },
];

async function run(fetchImpl: () => Promise<Response>, apiKey = "re_test") {
  vi.resetModules();
  vi.stubEnv("RESEND_API_KEY", apiKey);
  vi.stubGlobal("fetch", vi.fn(fetchImpl));
  const { checkSenders } = await import("@/lib/email/send");
  return checkSenders(senders);
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("checkSenders (domain verification against Resend)", () => {
  it("marks senders on verified domains, flags others, and notes unset ones", async () => {
    const out = await run(async () =>
      Response.json({ data: [{ name: "shilpikala.com", status: "verified" }, { name: "other.example", status: "pending" }] })
    );
    expect(out.map((o) => [o.kind, o.status])).toEqual([
      ["orders", "verified"],
      ["invoice", "verified"],
      ["account", "unverified"],
      ["general", "missing"],
    ]);
  });

  it("says 'unknown' (never guesses) for a send-only key", async () => {
    const out = await run(async () => new Response("{}", { status: 401 }));
    expect(out[0].status).toBe("unknown");
    expect(out[0].note).toMatch(/only send/);
  });

  it("says 'unknown' when there is no API key or Resend is unreachable", async () => {
    expect((await run(async () => Response.json({}), ""))[0].status).toBe("unknown");
    const out = await run(async () => { throw new Error("offline"); });
    expect(out[0]).toMatchObject({ status: "unknown" });
    expect(out[0].note).toContain("offline");
  });
});
