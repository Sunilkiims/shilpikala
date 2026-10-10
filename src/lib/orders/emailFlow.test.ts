import { createHmac } from "node:crypto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isolateStorageDir } from "@/test-support/tempStorageDir";
import { jsonRequest, routeParams } from "@/test-support/request";
import type { PendingOrder } from "@/lib/orders/pendingStore";

const { sendEmail } = vi.hoisted(() => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/email/send", () => ({ sendEmail }));

const KEY_SECRET = "key_secret_test";
const HOOK_SECRET = "hook_secret_test";
const ADMIN = "owner@example.com";

const address = {
  fullName: "Jane Doe", line1: "1 Test St", city: "Pune", state: "Maharashtra",
  postalCode: "411001", country: "India", phone: "+91 90000 00000",
};

let cleanup: () => void;
let verifyPost: (r: Request) => Promise<Response>;
let webhookPost: (r: Request) => Promise<Response>;
let orders: typeof import("@/lib/orders/store");
let pending: typeof import("@/lib/orders/pendingStore");
let outbox: typeof import("@/lib/email/outbox");
let orderEmails: typeof import("@/lib/orders/orderEmails");
let auth: typeof import("@/lib/auth/customers");

const sign = (o: string, p: string) => createHmac("sha256", KEY_SECRET).update(`${o}|${p}`).digest("hex");
const verifyReq = (o = "order_1", p = "pay_1", sig = sign(o, p)) =>
  jsonRequest("http://x/api/checkout/verify-payment", { body: { razorpayOrderId: o, razorpayPaymentId: p, razorpaySignature: sig } });

function hook(event: object, secret = HOOK_SECRET, signature?: string) {
  const raw = JSON.stringify(event);
  return new Request("http://x/api/webhooks/razorpay", {
    method: "POST",
    headers: { "x-razorpay-signature": signature ?? createHmac("sha256", secret).update(raw).digest("hex") },
    body: raw,
  });
}
const captured = (orderId = "order_1", paymentId = "pay_1", method = "card") => ({
  event: "payment.captured",
  payload: { payment: { entity: { id: paymentId, order_id: orderId, method, status: "captured" } } },
});

function snapshot(overrides: Partial<PendingOrder> = {}): PendingOrder {
  return {
    razorpayOrderId: "order_1",
    items: [{ productId: 1, name: "Mandala Wall Art", slug: "mandala", quantity: 2, price: "1000.00" }],
    itemsSubtotal: 2000, shipping: 150, amount: 2150, amountInPaise: 215000,
    customerEmail: "jane@example.com", address, createdAt: new Date().toISOString(),
    ...overrides,
  };
}

async function setup() {
  cleanup = isolateStorageDir();
  vi.stubEnv("RAZORPAY_KEY_SECRET", KEY_SECRET);
  vi.stubEnv("NEXT_PUBLIC_RAZORPAY_KEY_ID", "rzp_test_key");
  vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", HOOK_SECRET);
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("EMAIL_INVOICE_FROM", "invoice@shilpikala.com");
  vi.stubEnv("EMAIL_GENERAL_FROM", "hello@shilpikala.com");
  vi.stubEnv("EMAIL_RESET_FROM", "reset@shilpikala.com");
  vi.stubEnv("ADMIN_EMAIL", ADMIN);
  vi.stubEnv("SITE_URL", "https://shop.example.com");
  orders = await import("@/lib/orders/store");
  pending = await import("@/lib/orders/pendingStore");
  outbox = await import("@/lib/email/outbox");
  orderEmails = await import("@/lib/orders/orderEmails");
  auth = await import("@/lib/auth/customers");
  ({ POST: verifyPost } = await import("@/app/api/checkout/verify-payment/route"));
  ({ POST: webhookPost } = await import("@/app/api/webhooks/razorpay/route"));
}

const sentTo = (to: string) => sendEmail.mock.calls.map((c) => c[0]).filter((m) => m.to === to);

beforeEach(async () => {
  sendEmail.mockReset();
  sendEmail.mockResolvedValue(true);
  await setup();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  cleanup();
});

describe("verified purchase → two separate emails with the same PDF invoice", () => {
  it("sends the customer confirmation and the admin alert, each with an invoice attached", async () => {
    await pending.savePendingOrder(snapshot());
    const res = await verifyPost(verifyReq());
    expect(res.status).toBe(200);

    const order = (await orders.getAllOrders())[0];
    const num = `SK-${order.orderNumber}`;
    expect(sendEmail).toHaveBeenCalledTimes(2);

    const [customer] = sentTo("jane@example.com");
    expect(customer.from).toBe("ShilpiKala <invoice@shilpikala.com>");
    expect(customer.subject).toBe(`Order Confirmed – ShilpiKala | Order #${num}`);
    expect(customer.html).toContain("Mandala Wall Art");
    expect(customer.html).toContain("Jane Doe");
    expect(customer.html).toContain("https://shop.example.com/account");
    expect(customer.text).toContain(num);
    expect(customer.text).toContain("₹2,150.00");
    expect(customer.attachments).toHaveLength(1);
    expect(customer.attachments[0].filename).toMatch(/^ShilpiKala-Invoice-SK-2026-27-00001\.pdf$/);
    expect(customer.attachments[0].content.subarray(0, 5).toString()).toBe("%PDF-");

    const [admin] = sentTo(ADMIN);
    expect(admin.from).toBe("ShilpiKala Orders <invoice@shilpikala.com>");
    expect(admin.subject).toBe(`New Order Received – #${num}`);
    expect(admin.html).toContain("pay_1");
    expect(admin.html).toContain("jane@example.com");
    expect(admin.html).toContain("+91 90000 00000");
    expect(admin.html).toContain(`https://shop.example.com/admin/orders#order-${order.id}`);
    // The very same invoice goes to both.
    expect(admin.attachments[0].filename).toBe(customer.attachments[0].filename);
    expect(Buffer.compare(admin.attachments[0].content, customer.attachments[0].content)).toBe(0);

    const log = await outbox.listEmailLog();
    expect(log.map((l) => [l.kind, l.status]).sort()).toEqual([["order-admin", "sent"], ["order-confirmation", "sent"]]);
  });

  it("uses the payment method from the webhook when it is known", async () => {
    await pending.savePendingOrder(snapshot());
    await webhookPost(hook(captured("order_1", "pay_1", "upi")));
    const order = (await orders.getAllOrders())[0];
    expect(order.paymentMethod).toBe("upi");
    expect(sentTo("jane@example.com")[0].html).toContain("Paid via UPI");
  });

  it("records the order and stock before any email, and answers verified even if mail is down", async () => {
    sendEmail.mockResolvedValue(false);
    await pending.savePendingOrder(snapshot());
    const res = await verifyPost(verifyReq());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ verified: true });
    expect(await orders.getAllOrders()).toHaveLength(1);
    expect((await outbox.listEmailLog()).every((l) => l.status === "failed")).toBe(true);
  });

  it("still sends the customer email when ADMIN_EMAIL is not configured", async () => {
    // Re-isolate so modules re-read the environment without an admin address.
    cleanup();
    vi.unstubAllEnvs();
    cleanup = isolateStorageDir();
    vi.stubEnv("RAZORPAY_KEY_SECRET", KEY_SECRET);
    vi.stubEnv("NEXT_PUBLIC_RAZORPAY_KEY_ID", "rzp_test_key");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_INVOICE_FROM", "invoice@shilpikala.com");
    vi.stubEnv("ADMIN_EMAIL", "");
    vi.stubEnv("ADMIN_NOTIFICATION_EMAIL", "");
    const pend = await import("@/lib/orders/pendingStore");
    const { POST } = await import("@/app/api/checkout/verify-payment/route");
    await pend.savePendingOrder(snapshot());
    await POST(verifyReq());
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].to).toBe("jane@example.com");
  });
});

describe("failures and cancellations never send a confirmation", () => {
  it("bad signature: nothing recorded, nothing sent", async () => {
    await pending.savePendingOrder(snapshot());
    const res = await verifyPost(verifyReq("order_1", "pay_1", "0".repeat(64)));
    expect(res.status).toBe(400);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(await orders.getAllOrders()).toHaveLength(0);
  });

  it("payment.failed webhook (cancelled / declined): acknowledged, no order, no email", async () => {
    await pending.savePendingOrder(snapshot());
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const res = await webhookPost(hook({ event: "payment.failed", payload: { payment: { entity: { id: "pay_1", order_id: "order_1", status: "failed" } } } }));
    expect(res.status).toBe(200);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(await orders.getAllOrders()).toHaveLength(0);
    expect(await outbox.listEmailLog()).toHaveLength(0);
  });

  it("an authorized-but-not-captured payment does not create an order", async () => {
    await pending.savePendingOrder(snapshot());
    const ev = captured();
    ev.payload.payment.entity.status = "authorized";
    await webhookPost(hook(ev));
    expect(await orders.getAllOrders()).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("a genuine payment with no snapshot is flagged for reconciliation, not emailed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await webhookPost(hook(captured("order_unknown", "pay_x")));
    expect(res.status).toBe(200);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(await orders.listUnreconciledPayments()).toHaveLength(1);
  });
});

describe("Razorpay webhook", () => {
  it("is disabled (503) until a webhook secret is configured", async () => {
    vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "");
    expect((await webhookPost(hook(captured()))).status).toBe(503);
  });

  it("rejects missing and forged signatures without touching anything", async () => {
    await pending.savePendingOrder(snapshot());
    expect((await webhookPost(hook(captured(), HOOK_SECRET, "bad"))).status).toBe(400);
    expect((await webhookPost(hook(captured(), "wrong-secret"))).status).toBe(400);
    expect((await webhookPost(new Request("http://x", { method: "POST", body: JSON.stringify(captured()) }))).status).toBe(400);
    expect(await orders.getAllOrders()).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("returns 500 (so Razorpay retries) when the order cannot be recorded, then succeeds on retry", async () => {
    // customer_id has a foreign key: an unknown customer makes the insert fail.
    await pending.savePendingOrder(snapshot({ customerId: 987654 }));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect((await webhookPost(hook(captured()))).status).toBe(500);
    expect(await orders.getAllOrders()).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();

    await pending.savePendingOrder(snapshot()); // the condition clears
    expect((await webhookPost(hook(captured()))).status).toBe(200);
    expect(await orders.getAllOrders()).toHaveLength(1);
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  it("duplicate webhook deliveries, then the browser verify call: one order, one stock decrement, 2 emails total", async () => {
    await pending.savePendingOrder(snapshot());
    for (let i = 0; i < 3; i++) expect((await webhookPost(hook(captured()))).status).toBe(200);
    await verifyPost(verifyReq());
    await verifyPost(verifyReq());
    expect(await orders.getAllOrders()).toHaveLength(1);
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(await outbox.listEmailLog()).toHaveLength(2);
  });

  it("concurrent webhook + verify race still yields one order and each email once", async () => {
    await pending.savePendingOrder(snapshot());
    await Promise.all([
      webhookPost(hook(captured())),
      verifyPost(verifyReq()),
      webhookPost(hook(captured())),
      verifyPost(verifyReq()),
    ]);
    expect(await orders.getAllOrders()).toHaveLength(1);
    expect(sentTo("jane@example.com")).toHaveLength(1);
    expect(sentTo(ADMIN)).toHaveLength(1);
  });

  it("refund.processed marks the order refunded and tells the customer once", async () => {
    await pending.savePendingOrder(snapshot());
    await webhookPost(hook(captured()));
    sendEmail.mockClear();
    const refund = { event: "refund.processed", payload: { refund: { entity: { payment_id: "pay_1" } } } };
    await webhookPost(hook(refund));
    await webhookPost(hook(refund));
    expect((await orders.getAllOrders())[0].status).toBe("refunded");
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0]).toMatchObject({ to: "jane@example.com", from: "ShilpiKala <invoice@shilpikala.com>" });
    expect(sendEmail.mock.calls[0][0].subject).toMatch(/^Refund issued/);
  });
});

describe("email failures and retries", () => {
  it("one failing email does not stop the other, and a retry sends only what is missing", async () => {
    sendEmail.mockImplementation(async (m: { to: string; result?: { error?: string } }) => {
      if (m.to === "jane@example.com") {
        if (m.result) m.result.error = "provider 500";
        return false;
      }
      return true;
    });
    await pending.savePendingOrder(snapshot());
    await verifyPost(verifyReq());
    expect(sentTo(ADMIN)).toHaveLength(1); // admin was still attempted and sent
    let log = await outbox.listEmailLog();
    const failed = log.find((l) => l.kind === "order-confirmation")!;
    expect(failed).toMatchObject({ status: "failed", attempts: 1, lastError: "provider 500" });

    sendEmail.mockResolvedValue(true);
    const order = (await orders.getAllOrders())[0];
    const retry = await orderEmails.retryOrderEmails(order.id);
    expect(retry.orders).toBe(1);
    expect(sentTo("jane@example.com")).toHaveLength(2); // 1 failed + 1 retried
    expect(sentTo(ADMIN)).toHaveLength(1); // not re-sent
    log = await outbox.listEmailLog();
    expect(log.find((l) => l.kind === "order-confirmation")).toMatchObject({ status: "sent", attempts: 1 }) // an explicit retry re-arms the counter;
    expect(log.find((l) => l.kind === "order-confirmation")!.lastError).toBeUndefined();

    await orderEmails.retryOrderEmails(order.id); // nothing more to send
    expect(sendEmail).toHaveBeenCalledTimes(3);
  });

  it("stops automatic retries after the attempt limit, until an admin re-arms it", async () => {
    sendEmail.mockResolvedValue(false);
    await pending.savePendingOrder(snapshot());
    await verifyPost(verifyReq());
    const order = (await orders.getAllOrders())[0];
    for (let i = 0; i < 10; i++) await orderEmails.sendOrderEmails(order);
    const row = (await outbox.listEmailLog()).find((l) => l.kind === "order-confirmation")!;
    expect(row.attempts).toBe(outbox.MAX_EMAIL_ATTEMPTS);
    const calls = sendEmail.mock.calls.length;
    await orderEmails.sendOrderEmails(order);
    expect(sendEmail.mock.calls.length).toBe(calls);

    sendEmail.mockResolvedValue(true);
    await orderEmails.retryOrderEmails(order.id); // explicit admin retry re-arms
    expect((await outbox.listEmailLog()).find((l) => l.kind === "order-confirmation")!.status).toBe("sent");
  });

  it("the sweep finds recent orders whose confirmation never went out", async () => {
    sendEmail.mockResolvedValue(false);
    await pending.savePendingOrder(snapshot());
    await verifyPost(verifyReq());
    // Too fresh to sweep (could still be in flight)…
    expect(await orderEmails.findOrdersMissingEmails()).toHaveLength(0);
    // …but picked up once it is older than a couple of minutes.
    const { getDb } = await import("@/lib/db");
    await (await getDb()).query("UPDATE orders SET created_at = now() - interval '10 minutes'");
    expect(await orderEmails.findOrdersMissingEmails()).toHaveLength(1);
    sendEmail.mockResolvedValue(true);
    const r = await orderEmails.retryOrderEmails();
    expect(r.orders).toBe(1);
    expect(await orderEmails.findOrdersMissingEmails()).toHaveLength(0);
  });

  it("the outbox claim is atomic: concurrent identical sends deliver once", async () => {
    const input = { kind: "welcome" as const, key: "welcome:1", to: "a@b.co", from: "x <x@y.z>", subject: "s", html: "<p>h</p>", text: "t" };
    const results = await Promise.all(Array.from({ length: 6 }, () => outbox.deliver(input)));
    expect(results.filter((r) => r === "sent")).toHaveLength(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("a stale 'pending' claim from a crashed request can be taken over", async () => {
    const { getDb } = await import("@/lib/db");
    const db = await getDb();
    await db.query("INSERT INTO email_log (kind, dedupe_key, to_email, from_email, subject, status, attempts, updated_at) VALUES ('welcome','w:1','a@b.co','f','s','pending',1, now() - interval '30 minutes')");
    const input = { kind: "welcome" as const, key: "w:1", to: "a@b.co", from: "f", subject: "s", html: "h", text: "t" };
    expect(await outbox.deliver(input)).toBe("sent");
    await db.query("INSERT INTO email_log (kind, dedupe_key, to_email, from_email, subject, status, attempts) VALUES ('welcome','w:2','a@b.co','f','s','pending',1)");
    expect(await outbox.deliver({ ...input, key: "w:2" })).toBe("skipped"); // fresh claim is respected
  });

  it("an unexpected error inside the provider call is logged as a failure, never thrown", async () => {
    sendEmail.mockRejectedValue(new Error("boom"));
    const out = await outbox.deliver({ kind: "welcome", key: "w:9", to: "a@b.co", from: "f", subject: "s", html: "h", text: "t" });
    expect(out).toBe("failed");
    expect((await outbox.listEmailLog())[0].lastError).toContain("boom");
  });
});

describe("secure invoice downloads", () => {
  let orderA: import("@/lib/orders/types").StoredOrder;
  let alice: { id: number; cookie: string };
  let bob: { id: number; cookie: string };

  async function account(email: string, verified: boolean) {
    const c = await auth.createCustomer({ email, name: "Test", password: "correct horse battery" });
    if (c === "email_taken") throw new Error("taken");
    if (verified) await auth.markEmailVerified(c.id);
    const token = await auth.createSession(c.id);
    return { id: c.id, cookie: `sk_session=${token}` };
  }

  beforeEach(async () => {
    alice = await account("alice@example.com", true);
    bob = await account("bob@example.com", true);
    await pending.savePendingOrder(snapshot({ customerEmail: "alice@example.com", customerId: alice.id }));
    await verifyPost(verifyReq());
    orderA = (await orders.getAllOrders())[0];
  });

  const accountGet = async (id: string, cookie?: string) => {
    const { GET } = await import("@/app/api/account/orders/[id]/invoice/route");
    return GET(new Request("http://x", { headers: cookie ? { cookie } : {} }), routeParams({ id }));
  };

  it("lets the owner download the PDF, with no-store and attachment headers", async () => {
    const res = await accountGet(orderA.id, alice.cookie);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename="ShilpiKala-Invoice-/);
    const body = Buffer.from(await res.arrayBuffer());
    expect(body.subarray(0, 5).toString()).toBe("%PDF-");
    // The download is the same invoice that was emailed.
    expect(res.headers.get("content-disposition")).toContain(sentTo("alice@example.com")[0].attachments[0].filename);
  });

  it("works by short order number too", async () => {
    expect((await accountGet(`SK-${orderA.orderNumber}`, alice.cookie)).status).toBe(200);
  });

  it("another customer gets 404 (indistinguishable from a missing order); signed-out gets 401", async () => {
    expect((await accountGet(orderA.id, bob.cookie)).status).toBe(404);
    expect((await accountGet("does-not-exist", bob.cookie)).status).toBe(404);
    expect((await accountGet(orderA.id)).status).toBe(401);
  });

  it("an unverified account with the same email as a guest order cannot download it", async () => {
    const carol = await account("carol@example.com", false);
    await pending.savePendingOrder(snapshot({ razorpayOrderId: "order_2", customerEmail: "carol@example.com" }));
    await verifyPost(verifyReq("order_2", "pay_2"));
    const guestOrder = (await orders.getAllOrders()).find((o) => o.razorpayOrderId === "order_2")!;
    expect((await accountGet(guestOrder.id, carol.cookie)).status).toBe(404);
    await auth.markEmailVerified(carol.id);
    expect((await accountGet(guestOrder.id, carol.cookie)).status).toBe(200);
  });

  it("guests need both the reference and the matching email; every other combination is 404", async () => {
    const { POST } = await import("@/app/api/track-order/invoice/route");
    const call = (body: unknown, ip: string) => POST(jsonRequest("http://x", { body, ip }));
    const ok = await call({ orderId: orderA.id, email: "ALICE@example.com" }, "198.51.100.1");
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("application/pdf");
    expect((await call({ orderId: `SK-${orderA.orderNumber}`, email: "alice@example.com" }, "198.51.100.1")).status).toBe(200);
    expect((await call({ orderId: orderA.id, email: "bob@example.com" }, "198.51.100.1")).status).toBe(404);
    expect((await call({ orderId: "nope", email: "alice@example.com" }, "198.51.100.1")).status).toBe(404);
    expect((await call({ orderId: orderA.id }, "198.51.100.1")).status).toBe(400);
  });

  it("rate-limits guest invoice guessing", async () => {
    const { POST } = await import("@/app/api/track-order/invoice/route");
    let last = 0;
    for (let i = 0; i < 20; i++) {
      last = (await POST(jsonRequest("http://x", { body: { orderId: `SK-${5000 + i}`, email: "x@y.co" }, ip: "198.51.100.77" }))).status;
    }
    expect(last).toBe(429);
  });

  it("the admin route serves any order's invoice (the proxy guards /api/admin/*)", async () => {
    const { GET } = await import("@/app/api/admin/orders/[id]/invoice/route");
    expect((await GET(new Request("http://x"), routeParams({ id: orderA.id }))).status).toBe(200);
    expect((await GET(new Request("http://x"), routeParams({ id: "nope" }))).status).toBe(404);
  });

  it("each order has exactly one stable invoice number", async () => {
    await accountGet(orderA.id, alice.cookie);
    await accountGet(orderA.id, alice.cookie);
    const { getDb } = await import("@/lib/db");
    const res = await (await getDb()).query<{ n: number }>("SELECT COUNT(*) AS n FROM invoices");
    expect(Number(res.rows[0].n)).toBe(1);
  });
});

describe("account emails use the right sender", () => {
  it("welcome + verification from hello@, reset + password-changed from reset@", async () => {
    const { POST: register } = await import("@/app/api/auth/register/route");
    const { POST: forgot } = await import("@/app/api/auth/forgot-password/route");
    const reg = await register(jsonRequest("http://x", { ip: "198.51.100.10", body: { email: "new@example.com", name: "New Person", password: "correct horse battery" } }));
    expect(reg.status).toBe(201);
    const froms = sendEmail.mock.calls.map((c) => c[0].from);
    expect(froms).toEqual(["ShilpiKala <hello@shilpikala.com>", "ShilpiKala <hello@shilpikala.com>"]);
    const welcome = sendEmail.mock.calls.map((c) => c[0]).find((m) => /Welcome/.test(m.subject));
    expect(welcome.html).toContain("New Person");
    expect(welcome.text).toContain("New Person");

    sendEmail.mockClear();
    await forgot(jsonRequest("http://x", { ip: "198.51.100.11", body: { email: "new@example.com" } }));
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const reset = sendEmail.mock.calls[0][0];
    expect(reset.from).toBe("ShilpiKala <reset@shilpikala.com>");
    expect(reset.subject).toMatch(/Reset your/);
    expect(reset.text).toMatch(/https:\/\/shop\.example\.com\/account\/reset-password\?token=/);
    expect(reset.html).toContain("expires in 1 hour");

    const token = /token=([A-Za-z0-9_-]+)/.exec(reset.text)![1];
    sendEmail.mockClear();
    const { POST: doReset } = await import("@/app/api/auth/reset-password/route");
    const done = await doReset(jsonRequest("http://x", { ip: "198.51.100.12", body: { token, password: "another long passphrase" } }));
    expect(done.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0]).toMatchObject({ from: "ShilpiKala <reset@shilpikala.com>", to: "new@example.com" });
  });

  it("registration succeeds even when the email provider is down", async () => {
    sendEmail.mockResolvedValue(false);
    const { POST: register } = await import("@/app/api/auth/register/route");
    const res = await register(jsonRequest("http://x", { ip: "198.51.100.20", body: { email: "x@example.com", name: "X Y", password: "correct horse battery" } }));
    expect(res.status).toBe(201);
  });

  it("custom-art requests get a confirmation from hello@ and an alert to the owner", async () => {
    const { POST } = await import("@/app/api/inquiries/route");
    const res = await POST(jsonRequest("http://x", { ip: "198.51.100.30", body: {
      kind: "custom-art", name: "Asha Rao", email: "asha@example.com", message: "A large Lipan mirror for my hall, please.",
      style: "Lipan Art", budget: "10000",
    } }));
    expect(res.status).toBe(201);
    const receipt = sentTo("asha@example.com")[0];
    expect(receipt.from).toBe("ShilpiKala <hello@shilpikala.com>");
    expect(receipt.subject).toMatch(/Custom art request received/);
    expect(sentTo(ADMIN)).toHaveLength(1);
  });
});
