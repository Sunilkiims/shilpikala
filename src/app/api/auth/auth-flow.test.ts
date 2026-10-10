import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isolateStorageDir } from "@/test-support/tempStorageDir";
import { jsonRequest } from "@/test-support/request";

const sendEmail = vi.hoisted(() => vi.fn().mockResolvedValue(true));
vi.mock("@/lib/email/send", () => ({ sendEmail }));

let cleanup: () => void;
let ipCounter = 0;
const ip = () => `198.51.100.${++ipCounter % 250}`;

type Handler = (r: Request) => Promise<Response>;
let register: Handler, login: Handler, logout: Handler, forgot: Handler, reset: Handler, verify: Handler;
let profile: Handler;
let customers: typeof import("@/lib/auth/customers");
let session: typeof import("@/lib/auth/session");

beforeEach(async () => {
  cleanup = isolateStorageDir();
  sendEmail.mockClear();
  ({ POST: register } = await import("@/app/api/auth/register/route"));
  ({ POST: login } = await import("@/app/api/auth/login/route"));
  ({ POST: logout } = await import("@/app/api/auth/logout/route"));
  ({ POST: forgot } = await import("@/app/api/auth/forgot-password/route"));
  ({ POST: reset } = await import("@/app/api/auth/reset-password/route"));
  ({ POST: verify } = await import("@/app/api/auth/verify-email/route"));
  ({ PATCH: profile } = await import("@/app/api/account/profile/route"));
  customers = await import("@/lib/auth/customers");
  session = await import("@/lib/auth/session");
});
afterEach(() => cleanup());

const reg = (over: Record<string, unknown> = {}, address = ip()) =>
  register(jsonRequest("http://x/api/auth/register", {
    ip: address,
    body: { email: "Jane@Example.com", name: "Jane", password: "a-good-password", ...over },
  }));

function cookieFrom(response: Response): string {
  const header = response.headers.get("set-cookie") ?? "";
  return header.split(";")[0];
}

describe("register", () => {
  it("creates an account, normalises the email, signs in, and sends a verification email", async () => {
    const res = await reg();
    expect(res.status).toBe(201);
    const { customer } = await res.json();
    expect(customer.email).toBe("jane@example.com");
    expect(customer.emailVerified).toBe(false);
    expect(customer).not.toHaveProperty("password_hash");
    expect(res.headers.get("set-cookie")).toMatch(/HttpOnly/);
    expect(res.headers.get("set-cookie")).toMatch(/SameSite=Lax/);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].to).toBe("jane@example.com");
  });

  it("rejects a duplicate email (case-insensitively) with 409", async () => {
    await reg();
    expect((await reg({ email: "JANE@example.com" })).status).toBe(409);
  });

  it.each([
    [{ email: "nope" }, "invalid_email"],
    [{ name: "  " }, "invalid_name"],
    [{ password: "short" }, "password_too_short"],
  ])("validates input %j", async (over, error) => {
    const res = await reg(over);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(error);
  });

  it("rate-limits repeated registrations from one IP", async () => {
    const same = "192.0.2.77";
    let last = 0;
    for (let i = 0; i < 12; i++) last = (await reg({ email: `u${i}@example.com` }, same)).status;
    expect(last).toBe(429);
  });
});

describe("login / session / logout", () => {
  it("logs in with the right password and the session resolves to the customer", async () => {
    await reg();
    const res = await login(jsonRequest("http://x", { ip: ip(), body: { email: "jane@example.com", password: "a-good-password" } }));
    expect(res.status).toBe(200);
    const me = await session.getCustomerFromRequest(
      new Request("http://x", { headers: { cookie: cookieFrom(res) } })
    );
    expect(me?.email).toBe("jane@example.com");
  });

  it("gives the same 401 for a wrong password and an unknown email", async () => {
    await reg();
    const wrong = await login(jsonRequest("http://x", { ip: ip(), body: { email: "jane@example.com", password: "nope-nope-nope" } }));
    const unknown = await login(jsonRequest("http://x", { ip: ip(), body: { email: "ghost@example.com", password: "nope-nope-nope" } }));
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(await wrong.json()).toEqual(await unknown.json());
  });

  it("locks out a brute-force attempt from one IP", async () => {
    const same = "192.0.2.88";
    let last = 0;
    for (let i = 0; i < 17; i++) {
      last = (await login(jsonRequest("http://x", { ip: same, body: { email: "a@b.co", password: "x" } }))).status;
    }
    expect(last).toBe(429);
  });

  it("logout invalidates the session server-side", async () => {
    const res = await reg();
    const cookie = cookieFrom(res);
    const out = await logout(new Request("http://x", { method: "POST", headers: { cookie } }));
    expect(out.headers.get("set-cookie")).toMatch(/Max-Age=0/);
    expect(await session.getCustomerFromRequest(new Request("http://x", { headers: { cookie } }))).toBeUndefined();
  });

  it("ignores an unknown or empty session token", async () => {
    expect(await session.getCustomerFromRequest(new Request("http://x"))).toBeUndefined();
    expect(
      await session.getCustomerFromRequest(new Request("http://x", { headers: { cookie: "sk_session=forged" } }))
    ).toBeUndefined();
  });

  it("an expired session no longer works", async () => {
    const res = await reg();
    const cookie = cookieFrom(res);
    const { getDb } = await import("@/lib/db");
    await (await getDb()).exec("UPDATE sessions SET expires_at = now() - interval '1 minute'");
    expect(await session.getCustomerFromRequest(new Request("http://x", { headers: { cookie } }))).toBeUndefined();
  });
});

describe("email verification", () => {
  it("verifies once; the token cannot be reused", async () => {
    const res = await reg();
    const { customer } = await res.json();
    const token = await customers.createAuthToken(customer.id, "verify-email");

    expect((await verify(jsonRequest("http://x", { ip: ip(), body: { token } }))).status).toBe(200);
    expect((await customers.getCustomerByEmail("jane@example.com"))?.emailVerified).toBe(true);
    expect((await verify(jsonRequest("http://x", { ip: ip(), body: { token } }))).status).toBe(400);
  });

  it("rejects an unknown token and an expired token", async () => {
    const { customer } = await (await reg()).json();
    expect((await verify(jsonRequest("http://x", { ip: ip(), body: { token: "bogus" } }))).status).toBe(400);
    const token = await customers.createAuthToken(customer.id, "verify-email");
    const { getDb } = await import("@/lib/db");
    await (await getDb()).exec("UPDATE auth_tokens SET expires_at = now() - interval '1 minute'");
    expect((await verify(jsonRequest("http://x", { ip: ip(), body: { token } }))).status).toBe(400);
  });

  it("a reset token can't be used as a verification token", async () => {
    const { customer } = await (await reg()).json();
    const token = await customers.createAuthToken(customer.id, "reset-password");
    expect((await verify(jsonRequest("http://x", { ip: ip(), body: { token } }))).status).toBe(400);
  });
});

describe("password reset", () => {
  it("answers identically for known and unknown emails, but only emails real accounts", async () => {
    await reg();
    sendEmail.mockClear();
    const known = await forgot(jsonRequest("http://x", { ip: ip(), body: { email: "jane@example.com" } }));
    const knownMail = sendEmail.mock.calls.length;
    const unknown = await forgot(jsonRequest("http://x", { ip: ip(), body: { email: "ghost@example.com" } }));
    expect(known.status).toBe(200);
    expect(await known.json()).toEqual(await unknown.json());
    expect(knownMail).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("sets the new password, invalidates old sessions, and burns the token", async () => {
    const res = await reg();
    const { customer } = await res.json();
    const oldCookie = cookieFrom(res);
    const token = await customers.createAuthToken(customer.id, "reset-password");

    const done = await reset(jsonRequest("http://x", { ip: ip(), body: { token, password: "brand-new-password" } }));
    expect(done.status).toBe(200);

    expect(await session.getCustomerFromRequest(new Request("http://x", { headers: { cookie: oldCookie } }))).toBeUndefined();
    expect(await customers.authenticate("jane@example.com", "a-good-password")).toBeUndefined();
    expect(await customers.authenticate("jane@example.com", "brand-new-password")).toBeDefined();
    expect((await customers.getCustomerByEmail("jane@example.com"))?.emailVerified).toBe(true);

    const again = await reset(jsonRequest("http://x", { ip: ip(), body: { token, password: "another-password" } }));
    expect(again.status).toBe(400);
  });

  it("rejects a weak new password without consuming the token", async () => {
    const { customer } = await (await reg()).json();
    const token = await customers.createAuthToken(customer.id, "reset-password");
    expect((await reset(jsonRequest("http://x", { ip: ip(), body: { token, password: "short" } }))).status).toBe(400);
    expect(await customers.consumeAuthToken(token, "reset-password")).toBe(customer.id);
  });
});

describe("profile", () => {
  const address = { fullName: "Jane", line1: "1 Road", city: "Pune", state: "MH", postalCode: "411001", country: "India" };

  it("requires a session", async () => {
    const res = await profile(jsonRequest("http://x", { method: "PATCH", body: { name: "X" } }));
    expect(res.status).toBe(401);
  });

  it("saves a sanitised address and rejects an incomplete one", async () => {
    const cookie = cookieFrom(await reg());
    const ok = await profile(jsonRequest("http://x", { method: "PATCH", headers: { cookie }, body: { name: "Jane D", address: { ...address, isAdmin: true } } }));
    expect(ok.status).toBe(200);
    const { customer } = await ok.json();
    expect(customer.name).toBe("Jane D");
    expect(customer.address).not.toHaveProperty("isAdmin");

    const bad = await profile(jsonRequest("http://x", { method: "PATCH", headers: { cookie }, body: { name: "Jane", address: { fullName: "x" } } }));
    expect(bad.status).toBe(400);
  });
});

describe("order visibility", () => {
  const orderBase = {
    razorpayPaymentId: "pay_1", itemsSubtotal: 100, shipping: 0, amount: 100, currency: "INR" as const,
    address: { fullName: "G", line1: "a", city: "b", state: "c", postalCode: "1", country: "India" },
    items: [], status: "paid" as const, createdAt: new Date().toISOString(),
  };

  it("shows email-matched guest orders only once the email is verified", async () => {
    const orders = await import("@/lib/orders/store");
    await orders.appendOrder({ ...orderBase, id: "o1", razorpayOrderId: "r1", customerEmail: "jane@example.com" });
    const { customer } = await (await reg()).json();

    expect(await orders.getOrdersForCustomer(customer.id, null)).toHaveLength(0);
    expect(await orders.getOrdersForCustomer(customer.id, "jane@example.com")).toHaveLength(1);
  });

  it("an unverified account must not see a guest order placed with its email; verifying reveals it", async () => {
    const orders = await import("@/lib/orders/store");
    await orders.appendOrder({ ...orderBase, id: "o3", razorpayOrderId: "r3", customerEmail: "jane@example.com" });
    const { customer } = await (await reg()).json();

    expect(await orders.getOrdersForAccount({ id: customer.id, email: customer.email, emailVerified: false })).toHaveLength(0);
    expect(await orders.getOrdersForAccount({ id: customer.id, email: customer.email, emailVerified: true })).toHaveLength(1);
  });

  it("always shows orders linked by customer id", async () => {
    const orders = await import("@/lib/orders/store");
    const { customer } = await (await reg()).json();
    await orders.appendOrder({ ...orderBase, id: "o2", razorpayOrderId: "r2", customerEmail: "other@example.com", customerId: customer.id });
    expect(await orders.getOrdersForCustomer(customer.id, null)).toHaveLength(1);
  });
});
