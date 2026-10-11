import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isolateStorageDir } from "@/test-support/tempStorageDir";
import { jsonRequest } from "@/test-support/request";

const sendEmail = vi.hoisted(() => vi.fn().mockResolvedValue(true));
vi.mock("@/lib/email/send", () => ({ sendEmail }));

type Handler = (r: Request) => Promise<Response>;
let register: Handler, resend: Handler, verifyCode: Handler, login: Handler, profile: Handler;
let customers: typeof import("@/lib/auth/customers");
let session: typeof import("@/lib/auth/session");
let cleanup: () => void;
let ipCounter = 0;
const ip = () => `203.0.113.${++ipCounter % 250}`;

const EMAIL = "jane@example.com";
const PASSWORD = "a-good-password";

beforeEach(async () => {
  cleanup = isolateStorageDir();
  sendEmail.mockReset();
  sendEmail.mockResolvedValue(true);
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("ACCOUNT_EMAIL_FROM", "account@shilpikala.com");
  vi.stubEnv("SITE_URL", "https://shop.example.com");
  ({ POST: register } = await import("@/app/api/auth/register/route"));
  ({ POST: resend } = await import("@/app/api/auth/register/resend/route"));
  ({ POST: verifyCode } = await import("@/app/api/auth/register/verify/route"));
  ({ POST: login } = await import("@/app/api/auth/login/route"));
  ({ PATCH: profile } = await import("@/app/api/account/profile/route"));
  customers = await import("@/lib/auth/customers");
  session = await import("@/lib/auth/session");
});
afterEach(() => {
  vi.unstubAllEnvs();
  cleanup();
});

const post = (h: Handler, body: unknown, address = ip()) => h(jsonRequest("http://x", { ip: address, body }));
const start = (over: Record<string, unknown> = {}, address = ip()) =>
  post(register, { email: EMAIL, name: "Jane", password: PASSWORD, ...over }, address);
const verifyWith = (code: string, email = EMAIL, address = ip()) => post(verifyCode, { email, code }, address);

const otpMails = () => sendEmail.mock.calls.map((c) => c[0]).filter((m) => m.subject.startsWith("Verify your email address"));
const lastCode = () => /code is: (\d{6})/.exec(otpMails().at(-1)!.text)![1];
const wrongCode = () => (lastCode() === "000000" ? "111111" : "000000");

async function db() {
  return (await import("@/lib/db")).getDb();
}
const ageCooldown = async () => (await db()).exec("UPDATE email_otps SET last_sent_at = now() - interval '2 minutes'");
const expireCode = async () => (await db()).exec("UPDATE email_otps SET expires_at = now() - interval '1 second'");
const pendingRows = async () => (await (await db()).query("SELECT * FROM email_otps")).rows;

describe("1. successful registration + verification", () => {
  it("sends the code from account@, creates nothing until it is entered, then creates a verified, signed-in account", async () => {
    const res = await start({ email: "Jane@Example.COM" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "otp_sent", email: EMAIL, expiresInSeconds: 300, resendInSeconds: 60 });

    expect(otpMails()).toHaveLength(1);
    const mail = otpMails()[0];
    expect(mail).toMatchObject({ to: EMAIL, from: "ShilpiKala Account <account@shilpikala.com>", subject: "Verify your email address — ShilpiKala" });
    expect(lastCode()).toMatch(/^\d{6}$/);
    expect(mail.html).toContain(lastCode());
    expect(mail.html).toContain("expires in <strong>5 minutes");
    expect(mail.html).toMatch(/Never share this code/);
    expect(mail.html).toMatch(/didn't try to create an account/);
    expect(mail.text).toMatch(/Never share this code/);

    // Nothing exists yet — an unverified user record is never created.
    expect(await customers.getCustomerByEmail(EMAIL)).toBeUndefined();

    const ok = await verifyWith(lastCode());
    expect(ok.status).toBe(201);
    const { customer } = await ok.json();
    expect(customer).toMatchObject({ email: EMAIL, name: "Jane", emailVerified: true });
    expect(JSON.stringify(customer)).not.toMatch(/password/i);
    const cookie = (ok.headers.get("set-cookie") ?? "").split(";")[0];
    expect(ok.headers.get("set-cookie")).toMatch(/HttpOnly/);
    expect((await session.getCustomerFromRequest(new Request("http://x", { headers: { cookie } })))?.email).toBe(EMAIL);
    expect(await pendingRows()).toHaveLength(0);

    // Welcome email follows verification, from the same mailbox.
    const welcome = sendEmail.mock.calls.map((c) => c[0]).find((m) => /^Welcome/.test(m.subject));
    expect(welcome.from).toBe("ShilpiKala Account <account@shilpikala.com>");
    // And the new password works.
    expect(await customers.authenticate(EMAIL, PASSWORD)).toBeDefined();
  });

  it("never stores the code, and never puts it in the email log", async () => {
    await start();
    const code = lastCode();
    const rows = await pendingRows();
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain(code);
    expect((rows[0] as { code_hash: string }).code_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify((await (await db()).query("SELECT * FROM email_log")).rows)).not.toContain(code);
  });

  it("uses six-digit codes that vary", async () => {
    const seen = new Set<string>();
    for (let i = 0; i < 8; i++) {
      await start({ email: `u${i}@example.com` });
      seen.add(lastCode());
    }
    for (const c of seen) expect(c).toMatch(/^\d{6}$/);
    expect(seen.size).toBeGreaterThan(5);
  });
});

describe("2–4. wrong, expired and reused codes", () => {
  it("a wrong code is rejected and creates no account", async () => {
    await start();
    const res = await verifyWith(wrongCode());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_code");
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(await customers.getCustomerByEmail(EMAIL)).toBeUndefined();
  });

  it("malformed codes are rejected without touching the attempt counter", async () => {
    await start();
    for (const code of ["12345", "1234567", "abcdef", "12 345", ""]) {
      expect((await verifyWith(code)).status).toBe(400);
    }
    expect(((await pendingRows())[0] as { attempts: number }).attempts).toBe(0);
  });

  it("an expired code (older than 5 minutes) is rejected even when correct", async () => {
    await start();
    const code = lastCode();
    await expireCode();
    const res = await verifyWith(code);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("expired");
    expect(await customers.getCustomerByEmail(EMAIL)).toBeUndefined();
    expect(await pendingRows()).toHaveLength(0);
  });

  it("a code works once: replaying it fails, and only one account and session result", async () => {
    await start();
    const code = lastCode();
    expect((await verifyWith(code)).status).toBe(201);
    const again = await verifyWith(code);
    expect(again.status).toBe(400);
    expect(again.headers.get("set-cookie")).toBeNull();
    expect((await (await db()).query("SELECT 1 FROM customers")).rows).toHaveLength(1);
    expect((await (await db()).query("SELECT 1 FROM sessions")).rows).toHaveLength(1);
  });

  it("two simultaneous submissions of the right code: exactly one wins", async () => {
    await start();
    const code = lastCode();
    const results = await Promise.all([verifyWith(code), verifyWith(code), verifyWith(code)]);
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect((await (await db()).query("SELECT 1 FROM customers")).rows).toHaveLength(1);
  });

  it("a code for one email cannot verify another", async () => {
    await start();
    await start({ email: "other@example.com" });
    const code = lastCode(); // other's
    expect((await verifyWith(code, EMAIL)).status).toBe(400);
  });
});

describe("5. resending", () => {
  it("is blocked inside the 60-second cooldown", async () => {
    await start();
    const res = await post(resend, { email: EMAIL });
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("cooldown");
    expect(body.retryAfterSeconds).toBeGreaterThan(0);
    expect(body.retryAfterSeconds).toBeLessThanOrEqual(60);
    expect(otpMails()).toHaveLength(1);
  });

  it("after the cooldown a new code is sent, the old one stops working, and attempts reset", async () => {
    await start();
    const oldCode = lastCode();
    for (let i = 0; i < 2; i++) await verifyWith(wrongCode());
    await ageCooldown();

    const res = await post(resend, { email: EMAIL });
    expect(res.status).toBe(200);
    expect(otpMails()).toHaveLength(2);
    const newCode = lastCode();
    expect(((await pendingRows())[0] as { attempts: number }).attempts).toBe(0);

    if (newCode !== oldCode) expect((await verifyWith(oldCode)).status).toBe(400);
    expect((await verifyWith(newCode)).status).toBe(201);
  });

  it("registering again right away does not send a second code", async () => {
    await start();
    const res = await start();
    expect(res.status).toBe(200);
    expect((await res.json()).resendInSeconds).toBeLessThanOrEqual(60);
    expect(otpMails()).toHaveLength(1);
  });

  it("re-registering after the cooldown replaces the pending name/password and code", async () => {
    await start({ name: "Old Name", password: "old-password-1" });
    await ageCooldown();
    await start({ name: "New Name", password: "new-password-2" });
    expect(otpMails()).toHaveLength(2);
    expect((await verifyWith(lastCode())).status).toBe(201);
    expect((await customers.getCustomerByEmail(EMAIL))?.name).toBe("New Name");
    expect(await customers.authenticate(EMAIL, "old-password-1")).toBeUndefined();
    expect(await customers.authenticate(EMAIL, "new-password-2")).toBeDefined();
  });

  it("allows at most five codes per hour per address", async () => {
    for (let i = 0; i < 5; i++) {
      await ageCooldown();
      const r = i === 0 ? await start() : await post(resend, { email: EMAIL });
      expect(r.status).toBe(200);
    }
    await ageCooldown();
    const sixth = await post(resend, { email: EMAIL });
    expect(sixth.status).toBe(429);
    expect((await sixth.json()).error).toBe("otp_limit");
    expect(otpMails()).toHaveLength(5);
  });

  it("answers the same, sending nothing, when no registration is pending", async () => {
    const res = await post(resend, { email: "nobody@example.com" });
    expect(res.status).toBe(200);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("6. duplicate emails and enumeration", () => {
  it("gives the same answer for an existing account, emails only the owner, and creates nothing new", async () => {
    await verifyWith((await start(), lastCode())); // existing, verified account
    sendEmail.mockClear();

    const fresh = await start({ email: "brand-new@example.com" });
    const dup = await start({ email: "JANE@example.com", name: "Impostor", password: "impostor-password" });
    expect(dup.status).toBe(fresh.status);
    const a = await fresh.json();
    const b = await dup.json();
    expect(Object.keys(b).sort()).toEqual(Object.keys(a).sort());
    expect(b.status).toBe("otp_sent");

    const toOwner = sendEmail.mock.calls.map((c) => c[0]).filter((m) => m.to === EMAIL);
    expect(toOwner).toHaveLength(1);
    expect(toOwner[0].subject).toBe("You already have a ShilpiKala account");
    expect(toOwner[0].from).toBe("ShilpiKala Account <account@shilpikala.com>");
    expect(toOwner[0].text).not.toMatch(/\d{6}/);
    // The owner's account is untouched.
    expect(await customers.authenticate(EMAIL, PASSWORD)).toBeDefined();
    expect(await customers.authenticate(EMAIL, "impostor-password")).toBeUndefined();
    expect((await pendingRows()).map((r) => (r as { email: string }).email)).toEqual(["brand-new@example.com"]);
    expect((await verifyWith("123456")).status).toBe(400); // nothing to verify
  });

  it("sends the owner at most one notice per hour", async () => {
    await verifyWith((await start(), lastCode()));
    sendEmail.mockClear();
    await start({ password: "other-password-1" });
    await start({ password: "other-password-2" });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});

describe("7. invalid input", () => {
  it.each([
    [{ email: "nope" }, "invalid_email"],
    [{ email: "a@b" }, "invalid_email"],
    [{ email: 42 }, "invalid_email"],
    [{ name: "   " }, "invalid_name"],
    [{ password: "short" }, "password_too_short"],
  ])("rejects %j", async (over, error) => {
    const res = await start(over as Record<string, unknown>);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(error);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(await pendingRows()).toHaveLength(0);
  });

  it("rejects a non-JSON body", async () => {
    const res = await register(new Request("http://x", { method: "POST", body: "nope", headers: { "x-forwarded-for": ip() } }));
    expect(res.status).toBe(400);
  });
});

describe("8. too many wrong attempts", () => {
  it("locks the code after five tries — even the right code is then refused — until a new one is requested", async () => {
    await start();
    const code = lastCode();
    const wrong = wrongCode();
    const results: number[] = [];
    for (let i = 0; i < 5; i++) results.push((await verifyWith(wrong)).status);
    expect(results.slice(0, 4)).toEqual([400, 400, 400, 400]);
    expect(results[4]).toBe(429);

    const late = await verifyWith(code);
    expect(late.status).toBe(429);
    expect((await late.json()).error).toBe("too_many_attempts");
    expect(await customers.getCustomerByEmail(EMAIL)).toBeUndefined();

    await ageCooldown();
    expect((await post(resend, { email: EMAIL })).status).toBe(200);
    expect((await verifyWith(lastCode())).status).toBe(201);
  });

  it("the right code still works on the fifth attempt", async () => {
    await start();
    const code = lastCode();
    for (let i = 0; i < 4; i++) await verifyWith(wrongCode());
    expect((await verifyWith(code)).status).toBe(201);
  });
});

describe("9. rate limiting", () => {
  it("limits registrations per IP", async () => {
    const same = "192.0.2.150";
    let last = 0;
    for (let i = 0; i < 12; i++) last = (await start({ email: `u${i}@example.com` }, same)).status;
    expect(last).toBe(429);
  });

  it("limits verification guesses per IP", async () => {
    const same = "192.0.2.151";
    let last = 0;
    for (let i = 0; i < 32; i++) last = (await verifyWith("123456", `x${i}@example.com`, same)).status;
    expect(last).toBe(429);
  });

  it("limits resend requests per IP", async () => {
    const same = "192.0.2.152";
    let last = 0;
    for (let i = 0; i < 12; i++) last = (await post(resend, { email: `r${i}@example.com` }, same)).status;
    expect(last).toBe(429);
  });
});

describe("10. email delivery failure", () => {
  it("reports it, creates no account, and lets the person retry immediately", async () => {
    sendEmail.mockResolvedValue(false);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await start();
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("email_failed");
    expect(await customers.getCustomerByEmail(EMAIL)).toBeUndefined();

    sendEmail.mockResolvedValue(true);
    const retry = await start(); // no 60-second wait after a failed send
    expect(retry.status).toBe(200);
    expect((await verifyWith(lastCode())).status).toBe(201);
  });

  it("a thrown provider error is a clean 502 too", async () => {
    sendEmail.mockRejectedValue(new Error("network down"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect((await start()).status).toBe(502);
  });

  it("refuses to sign anyone up when email is not configured at all", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.resetModules();
    const { POST } = await import("@/app/api/auth/register/route");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await POST(jsonRequest("http://x", { ip: ip(), body: { email: EMAIL, name: "J", password: PASSWORD } }));
    expect(res.status).toBe(503);
  });
});

describe("11. unverified accounts cannot use account features", () => {
  async function legacyAccount() {
    const created = await customers.createCustomer({ email: EMAIL, name: "Squatter", password: "squatter-password" });
    if (created === "email_taken") throw new Error("taken");
    return created;
  }

  it("a never-verified session is not honoured (profile gives 401)", async () => {
    const legacy = await legacyAccount();
    const token = await customers.createSession(legacy.id);
    const cookie = `sk_session=${token}`;
    expect(await customers.getCustomerBySession(token)).toBeUndefined();
    const res = await profile(jsonRequest("http://x", { method: "PATCH", headers: { cookie }, body: { name: "X" } }));
    expect(res.status).toBe(401);
    const me = await (await import("@/app/api/auth/me/route")).GET(new Request("http://x", { headers: { cookie } }));
    expect((await me.json()).customer).toBeNull();
  });

  it("signing in to a never-verified account sends a code instead of a session; the code then completes sign-in", async () => {
    await legacyAccount();
    const res = await post(login, { email: EMAIL, password: "squatter-password" });
    expect(res.status).toBe(403);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(await res.json()).toMatchObject({ error: "email_not_verified", email: EMAIL, resendInSeconds: 60 });
    expect(otpMails()).toHaveLength(1);

    const wrongPw = await post(login, { email: EMAIL, password: "not-the-password" });
    expect(wrongPw.status).toBe(401);
    expect(otpMails()).toHaveLength(1); // no code for someone who doesn't know the password

    const ok = await verifyWith(lastCode());
    expect(ok.status).toBe(201);
    expect((await customers.getCustomerByEmail(EMAIL))?.emailVerified).toBe(true);
    expect(await customers.authenticate(EMAIL, "squatter-password")).toBeDefined(); // their own password is unchanged
  });

  it("someone who registers an address a squatter grabbed takes it over, and the squatter's sessions die", async () => {
    const legacy = await legacyAccount();
    const squatterToken = await customers.createSession(legacy.id);
    await start({ name: "Real Owner", password: "owner-password-1" });
    expect((await verifyWith(lastCode())).status).toBe(201);

    expect(await customers.authenticate(EMAIL, "squatter-password")).toBeUndefined();
    expect(await customers.authenticate(EMAIL, "owner-password-1")).toMatchObject({ name: "Real Owner", emailVerified: true });
    const rows = await (await db()).query("SELECT 1 FROM sessions WHERE token_hash IS NOT NULL AND customer_id = $1", [legacy.id]);
    expect(rows.rows).toHaveLength(1); // only the new, verified session
    expect(await customers.getCustomerBySession(squatterToken)).toBeUndefined();
  });

  it("a verified account signs in normally", async () => {
    await start();
    await verifyWith(lastCode());
    const res = await post(login, { email: EMAIL, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/sk_session=/);
  });
});

describe("housekeeping", () => {
  it("removes registrations that expired long ago", async () => {
    await start({ email: "stale@example.com" });
    await (await db()).exec("UPDATE email_otps SET expires_at = now() - interval '3 hours'");
    await start({ email: "fresh@example.com" });
    expect((await pendingRows()).map((r) => (r as { email: string }).email)).toEqual(["fresh@example.com"]);
  });
});
