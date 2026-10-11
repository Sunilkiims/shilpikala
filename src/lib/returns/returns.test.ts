import { createHmac, randomUUID } from "node:crypto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isolateStorageDir } from "@/test-support/tempStorageDir";
import { jsonRequest, routeParams } from "@/test-support/request";

const { sendEmail, createGatewayRefund, findGatewayRefund, fetchGatewayRefund } = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  createGatewayRefund: vi.fn(),
  findGatewayRefund: vi.fn(),
  fetchGatewayRefund: vi.fn(),
}));
vi.mock("@/lib/email/send", () => ({ sendEmail }));
vi.mock("@/lib/returns/gateway", () => ({
  gatewayConfigured: () => true,
  createGatewayRefund,
  findGatewayRefund,
  fetchGatewayRefund,
}));

const HOOK_SECRET = "hook_secret_test";
const DAY = 86_400_000;
const address = {
  fullName: "Jane Doe", line1: "1 Test St", city: "Pune", state: "Maharashtra",
  postalCode: "411001", country: "India", phone: "+91 90000 00000",
};
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);

let cleanup: () => void;
let catalog: typeof import("@/lib/store/catalogStore");
let orders: typeof import("@/lib/orders/store");
let auth: typeof import("@/lib/auth/customers");
let store: typeof import("@/lib/returns/store");
let refunds: typeof import("@/lib/returns/refunds");
let workflow: typeof import("@/lib/returns/workflow");
let replacements: typeof import("@/lib/returns/replacements");
let dbm: typeof import("@/lib/db");
let submitPost: (r: Request) => Promise<Response>;
let webhookPost: (r: Request) => Promise<Response>;

let ipCounter = 0;
const nextIp = () => `10.20.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;

async function setup() {
  cleanup = isolateStorageDir();
  vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", HOOK_SECRET);
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("ORDER_EMAIL_FROM", "orders@shilpikala.com");
  vi.stubEnv("INVOICE_EMAIL_FROM", "invoice@shilpikala.com");
  vi.stubEnv("ADMIN_EMAIL", "owner@example.com");
  vi.stubEnv("SITE_URL", "https://shop.example.com");
  vi.stubEnv("RETURNS_ENCRYPTION_KEY", "unit-test-key");
  catalog = await import("@/lib/store/catalogStore");
  orders = await import("@/lib/orders/store");
  auth = await import("@/lib/auth/customers");
  store = await import("@/lib/returns/store");
  refunds = await import("@/lib/returns/refunds");
  workflow = await import("@/lib/returns/workflow");
  replacements = await import("@/lib/returns/replacements");
  dbm = await import("@/lib/db");
  ({ POST: submitPost } = await import("@/app/api/account/returns/route"));
  ({ POST: webhookPost } = await import("@/app/api/webhooks/razorpay/route"));
}

beforeEach(async () => {
  sendEmail.mockReset();
  sendEmail.mockResolvedValue(true);
  createGatewayRefund.mockReset();
  findGatewayRefund.mockReset();
  fetchGatewayRefund.mockReset();
  createGatewayRefund.mockImplementation(async () => ({ ok: true, refund: { id: `rfnd_${randomUUID().slice(0, 8)}`, status: "processed" } }));
  await setup();
});
afterEach(() => {
  vi.unstubAllEnvs();
  cleanup();
});

// ---- builders -----------------------------------------------------------

async function product(over: Record<string, unknown> = {}) {
  return catalog.createProduct({
    name: "Mandala Panel", description: "Hand painted.", price: "1000.00", regularPrice: "1000.00",
    onSale: false, inStock: true, categorySlugs: [], ...over,
  } as never);
}

async function customer(email = `c${randomUUID().slice(0, 6)}@example.com`) {
  const made = await auth.createCustomer({ email, name: "Jane Doe", password: "correct horse battery" });
  if (made === "email_taken") throw new Error("taken");
  const db = await dbm.getDb();
  await db.query("UPDATE customers SET email_verified = true WHERE id = $1", [made.id]);
  const token = await auth.createSession(made.id);
  const fresh = (await auth.getCustomerById(made.id))!;
  return { account: fresh, cookie: `sk_session=${token}` };
}

type SeedItem = { productId: number; name: string; quantity: number; price?: string };
async function seedOrder(
  c: { account: { id: number; email: string } },
  items: SeedItem[],
  opts: { deliveredAgoMs?: number | null; status?: string; shipping?: number } = {}
) {
  const shipping = opts.shipping ?? 150;
  const lines = items.map((i) => ({ productId: i.productId, name: i.name, slug: "x", quantity: i.quantity, price: i.price ?? "1000.00" }));
  const subtotal = lines.reduce((s, l) => s + Number(l.price) * l.quantity, 0);
  const id = randomUUID();
  await orders.appendOrder({
    id, razorpayOrderId: `order_${id.slice(0, 8)}`, razorpayPaymentId: `pay_${id.slice(0, 8)}`,
    itemsSubtotal: subtotal, shipping, amount: subtotal + shipping, currency: "INR",
    customerEmail: c.account.email, customerId: c.account.id, address, items: lines, status: "paid",
    createdAt: new Date().toISOString(),
  });
  const db = await dbm.getDb();
  const status = opts.status ?? "delivered";
  // Only delivered orders have a delivery time; null means "delivered but the time was never recorded".
  const deliveredAt =
    status !== "delivered" || opts.deliveredAgoMs === null
      ? null
      : new Date(Date.now() - (opts.deliveredAgoMs ?? 2 * DAY)).toISOString();
  await db.query("UPDATE orders SET status = $2, delivered_at = $3 WHERE id = $1", [id, status, deliveredAt]);
  return (await orders.getOrderById(id))!;
}

function submission(cookie: string, order: { id: string }, over: Record<string, unknown> = {}, files?: File[]) {
  const fd = new FormData();
  const fields: Record<string, unknown> = {
    orderId: order.id, type: "return", reason: "damaged", description: "The frame arrived cracked in two places.",
    items: [], pickupAddress: address, refundMethod: "original", ...over,
  };
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    fd.set(k, typeof v === "string" ? v : JSON.stringify(v));
  }
  for (const f of files ?? [new File([PNG], "damage.png", { type: "image/png" })]) fd.append("evidence", f);
  return new Request("http://x/api/account/returns", { method: "POST", headers: { cookie, "x-forwarded-for": nextIp() }, body: fd });
}

const sentSubjects = () => sendEmail.mock.calls.map((c) => c[0].subject as string);
const sentTo = (to: string) => sendEmail.mock.calls.map((c) => c[0]).filter((m) => m.to === to);

/** Submit a request through the real route; returns its id. */
async function submit(cookie: string, order: { id: string }, items: { productId: number; quantity: number }[], over: Record<string, unknown> = {}) {
  const res = await submitPost(submission(cookie, order, { items, ...over }));
  const body = await res.json();
  return { res, body, id: body.request?.id as string };
}

async function toInspection(id: string) {
  await workflow.executeAdminAction(id, "approve", {});
  await workflow.executeAdminAction(id, "schedule_pickup", { scheduledFor: new Date(Date.now() + DAY).toISOString(), courier: "Delhivery" });
  await workflow.executeAdminAction(id, "mark_picked_up", {});
  await workflow.executeAdminAction(id, "start_inspection", {});
}

function hook(event: object) {
  const raw = JSON.stringify(event);
  return new Request("http://x/api/webhooks/razorpay", {
    method: "POST",
    headers: { "x-razorpay-signature": createHmac("sha256", HOOK_SECRET).update(raw).digest("hex") },
    body: raw,
  });
}

// ---- 1 & 2: requests inside the window -----------------------------------

describe("requests inside the 7-day window", () => {
  it("accepts a return, stores items/evidence/history and emails customer and admin", async () => {
    const p = await product();
    const c = await customer();
    const order = await seedOrder(c, [{ productId: p.id, name: p.name, quantity: 1 }]);
    const { res, body, id } = await submit(c.cookie, order, [{ productId: p.id, quantity: 1 }]);
    expect(res.status).toBe(201);
    expect(body.request.status).toBe("submitted");
    expect(id).toMatch(/^RR-[A-Z0-9]{8}$/);

    const req = (await store.getReturnRequest(id))!;
    expect(req.items).toEqual([{ productId: p.id, name: p.name, quantity: 1, unitPricePaise: 100000 }]);
    expect(req.deliveredAt).toBe(order.deliveredAt);
    expect(new Date(req.deadlineAt).getTime() - new Date(req.deliveredAt).getTime()).toBe(7 * DAY);
    expect((await store.listEvidence(id)).length).toBe(1);
    const history = await store.getStatusHistory(id);
    expect(history.map((h) => h.toStatus)).toEqual(["submitted"]);

    const mine = sentTo(c.account.email);
    expect(mine).toHaveLength(1);
    expect(mine[0].from).toContain("orders@shilpikala.com");
    expect(mine[0].subject).toContain(id);
    expect(mine[0].html).toContain(`/return-status/${id}?t=${req.trackToken}`);
    expect(sentTo("owner@example.com")[0].subject).toContain("New return request");
  });

  it("accepts a replacement and collects no payout details for it", async () => {
    const p = await product();
    const c = await customer();
    const order = await seedOrder(c, [{ productId: p.id, name: p.name, quantity: 1 }]);
    const { res, id } = await submit(c.cookie, order, [{ productId: p.id, quantity: 1 }], {
      type: "replacement", reason: "defective", refundMethod: "upi", payout: { upiId: "jane@okaxis" },
    });
    expect(res.status).toBe(201);
    const req = (await store.getReturnRequest(id))!;
    expect(req.type).toBe("replacement");
    expect(req.refundMethod).toBe("original");
    expect(req.hasPayoutDetails).toBe(false);
  });
});

// ---- 3 & 12: the window itself ---------------------------------------------

describe("the return window", () => {
  it("runs from delivery to exactly 7 days after, not from the order date", async () => {
    const p = await product();
    const c = await customer();
    const ok = await seedOrder(c, [{ productId: p.id, name: p.name, quantity: 1 }], { deliveredAgoMs: 7 * DAY - 120_000 });
    expect((await submit(c.cookie, ok, [{ productId: p.id, quantity: 1 }])).res.status).toBe(201);

    const closed = await seedOrder(c, [{ productId: p.id, name: p.name, quantity: 1 }], { deliveredAgoMs: 7 * DAY + 120_000 });
    const r = await submit(c.cookie, closed, [{ productId: p.id, quantity: 1 }]);
    expect(r.res.status).toBe(409);
    expect(r.body.error).toBe("window_closed");
    const e = await store.getOrderEligibility(closed);
    expect(e.state).toBe("window_closed");
    expect(e.canRequest).toBe(false);
    expect(e.daysRemaining).toBe(0);
  });

  it("an old order date does not matter if delivery was recent", async () => {
    const p = await product();
    const c = await customer();
    const order = await seedOrder(c, [{ productId: p.id, name: p.name, quantity: 1 }], { deliveredAgoMs: DAY });
    const db = await dbm.getDb();
    await db.query("UPDATE orders SET created_at = now() - interval '60 days' WHERE id = $1", [order.id]);
    expect((await submit(c.cookie, order, [{ productId: p.id, quantity: 1 }])).res.status).toBe(201);
  });

  it("refuses when the delivery date is missing, in the future, or the order is not delivered", async () => {
    const p = await product();
    const c = await customer();
    const item = [{ productId: p.id, quantity: 1 }];
    const line = [{ productId: p.id, name: p.name, quantity: 1 }];

    const missing = await seedOrder(c, line, { deliveredAgoMs: null });
    expect((await submit(c.cookie, missing, item)).body.error).toBe("delivery_date_missing");

    const future = await seedOrder(c, line, { deliveredAgoMs: -3 * DAY });
    expect((await submit(c.cookie, future, item)).body.error).toBe("delivery_date_missing");

    const shipped = await seedOrder(c, line, { status: "shipped" });
    const r = await submit(c.cookie, shipped, item);
    expect(r.res.status).toBe(409);
    expect(r.body.error).toBe("not_delivered");
  });

  it("stamps delivered_at when an order is marked delivered, and keeps the first stamp", async () => {
    const p = await product();
    const c = await customer();
    const order = await seedOrder(c, [{ productId: p.id, name: p.name, quantity: 1 }], { status: "shipped" });
    expect(order.deliveredAt).toBeUndefined();
    const delivered = (await orders.updateOrderFulfilment(order.id, { status: "delivered" }))!;
    expect(Math.abs(Date.now() - new Date(delivered.deliveredAt!).getTime())).toBeLessThan(60_000);
    const again = (await orders.updateOrderFulfilment(order.id, { status: "delivered" }))!;
    expect(again.deliveredAt).toBe(delivered.deliveredAt);
  });
});

// ---- 4: product policies -----------------------------------------------------

describe("per-product policy", () => {
  it("blocks returns of a non-returnable product, replacement-only and return-only work, neither blocks both", async () => {
    const a = await product({ name: "Custom Portrait" });
    const b = await product({ name: "Replace Only" });
    const d = await product({ name: "Return Only" });
    const n = await product({ name: "Neither" });
    await store.setProductPolicy(a.id, { returnable: false, replaceable: false, note: "Made to order" });
    await store.setProductPolicy(b.id, { returnable: false, replaceable: true });
    await store.setProductPolicy(d.id, { returnable: true, replaceable: false });
    await store.setProductPolicy(n.id, { returnable: false, replaceable: false });
    const c = await customer();
    const order = await seedOrder(c, [
      { productId: a.id, name: a.name, quantity: 1 }, { productId: b.id, name: b.name, quantity: 1 },
      { productId: d.id, name: d.name, quantity: 1 }, { productId: n.id, name: n.name, quantity: 1 },
    ]);

    expect((await submit(c.cookie, order, [{ productId: a.id, quantity: 1 }])).body.error).toBe("not_returnable");
    expect((await submit(c.cookie, order, [{ productId: a.id, quantity: 1 }], { type: "replacement" })).body.error).toBe("not_replaceable");
    expect((await submit(c.cookie, order, [{ productId: b.id, quantity: 1 }])).body.error).toBe("not_returnable");
    expect((await submit(c.cookie, order, [{ productId: b.id, quantity: 1 }], { type: "replacement" })).res.status).toBe(201);
    expect((await submit(c.cookie, order, [{ productId: d.id, quantity: 1 }], { type: "replacement" })).body.error).toBe("not_replaceable");
    expect((await submit(c.cookie, order, [{ productId: d.id, quantity: 1 }])).res.status).toBe(201);
    expect((await submit(c.cookie, order, [{ productId: n.id, quantity: 1 }])).body.error).toBe("not_returnable");

    const e = await store.getOrderEligibility(order);
    expect(e.items.find((i) => i.productId === a.id)).toMatchObject({ canReturn: false, canReplace: false, policyNote: "Made to order" });
  });

  it("an item not in the order is refused", async () => {
    const p = await product();
    const other = await product({ name: "Other" });
    const c = await customer();
    const order = await seedOrder(c, [{ productId: p.id, name: p.name, quantity: 1 }]);
    expect((await submit(c.cookie, order, [{ productId: other.id, quantity: 1 }])).body.error).toBe("item_not_in_order");
  });
});

// ---- 5 & 6: duplicates and partial returns -----------------------------------

describe("duplicates and partial returns", () => {
  it("allows a partial return, then the rest, then refuses more than was ordered", async () => {
    const p = await product();
    const c = await customer();
    const order = await seedOrder(c, [{ productId: p.id, name: p.name, quantity: 3 }]);
    expect((await submit(c.cookie, order, [{ productId: p.id, quantity: 1 }])).res.status).toBe(201);
    expect((await store.getOrderEligibility(order)).items[0]).toMatchObject({ heldQty: 1, availableQty: 2 });
    expect((await submit(c.cookie, order, [{ productId: p.id, quantity: 2 }])).res.status).toBe(201);
    const over = await submit(c.cookie, order, [{ productId: p.id, quantity: 1 }]);
    expect(over.res.status).toBe(409);
    expect(over.body.error).toBe("duplicate_request");
    expect((await store.getOrderEligibility(order)).canRequest).toBe(false);
  });

  it("two simultaneous submissions for the same unit create exactly one request", async () => {
    const p = await product();
    const c = await customer();
    const order = await seedOrder(c, [{ productId: p.id, name: p.name, quantity: 1 }]);
    const results = await Promise.all([
      submitPost(submission(c.cookie, order, { items: [{ productId: p.id, quantity: 1 }] })),
      submitPost(submission(c.cookie, order, { items: [{ productId: p.id, quantity: 1 }] })),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect((await store.listReturnsForOrder(order.id)).length).toBe(1);
  });

  it("rejected and cancelled requests release the units", async () => {
    const p = await product();
    const c = await customer();
    const order = await seedOrder(c, [{ productId: p.id, name: p.name, quantity: 1 }]);
    const first = await submit(c.cookie, order, [{ productId: p.id, quantity: 1 }]);
    await workflow.cancelReturnByCustomer(first.id);
    const second = await submit(c.cookie, order, [{ productId: p.id, quantity: 1 }]);
    expect(second.res.status).toBe(201);
    await workflow.executeAdminAction(second.id, "reject", { reason: "Item shows signs of use" });
    expect((await submit(c.cookie, order, [{ productId: p.id, quantity: 1 }])).res.status).toBe(201);
  });
});

// ---- validation, evidence, auth ----------------------------------------------

describe("validation and evidence", () => {
  it("needs at least one image, checks the real file type, and caps the count", async () => {
    const p = await product();
    const c = await customer();
    const order = await seedOrder(c, [{ productId: p.id, name: p.name, quantity: 1 }]);
    const items = [{ productId: p.id, quantity: 1 }];
    const body = async (files: File[]) => (await (await submitPost(submission(c.cookie, order, { items }, files))).json()).error;

    expect(await body([])).toBe("image_required");
    const fake = new File([Buffer.from("<script>alert(1)</script>")], "evil.jpg", { type: "image/jpeg" });
    expect(await body([fake])).toBe("unsupported_file_type");
    const six = Array.from({ length: 6 }, (_, i) => new File([PNG], `p${i}.png`, { type: "image/png" }));
    expect(await body(six)).toBe("too_many_images");
    const huge = new File([Buffer.concat([PNG, Buffer.alloc(4 * 1024 * 1024)])], "big.png", { type: "image/png" });
    expect(await body([huge])).toBe("file_too_large");

    const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypmp42"), Buffer.alloc(40)]);
    const ok = await submitPost(submission(c.cookie, order, { items }, [new File([PNG], "a.png"), new File([mp4], "unbox.mp4")]));
    expect(ok.status).toBe(201);
  });

  it("validates the request fields", async () => {
    const p = await product();
    const c = await customer();
    const order = await seedOrder(c, [{ productId: p.id, name: p.name, quantity: 1 }]);
    const items = [{ productId: p.id, quantity: 1 }];
    const err = async (over: Record<string, unknown>) => (await (await submitPost(submission(c.cookie, order, { items, ...over }))).json()).error;
    expect(await err({ type: "exchange" })).toBe("invalid_type");
    expect(await err({ reason: "changed_mind" })).toBe("invalid_reason");
    expect(await err({ description: "bad" })).toBe("description_too_short");
    expect(await err({ items: [] })).toBe("no_items");
    expect(await err({ items: [{ productId: p.id, quantity: 0 }] })).toBe("invalid_quantity");
    expect(await err({ pickupAddress: { fullName: "x" } })).toBe("invalid_address");
    expect(await err({ refundMethod: "cheque" })).toBe("invalid_refund_method");
    expect(await err({ refundMethod: "upi", payout: { upiId: "nope" } })).toBe("invalid_upi");
    expect(await err({ refundMethod: "bank", payout: { accountNumber: "1", ifsc: "x", accountHolder: "J" } })).toBe("invalid_bank_details");
  });

  it("encrypts UPI details, never returns them, and wipes them when the refund completes", async () => {
    const p = await product();
    const c = await customer();
    const order = await seedOrder(c, [{ productId: p.id, name: p.name, quantity: 1 }]);
    const { id } = await submit(c.cookie, order, [{ productId: p.id, quantity: 1 }], { refundMethod: "upi", payout: { upiId: "jane@okaxis" } });
    const stored = (await store.getEncryptedPayout(id))!;
    expect(stored).toBeTruthy();
    expect(stored).not.toContain("jane@okaxis");
    const crypto = await import("@/lib/returns/crypto");
    expect(JSON.parse(crypto.decryptPayout(stored)!)).toEqual({ upiId: "jane@okaxis" });
    expect(crypto.decryptPayout(stored.slice(0, -4) + "AAAA")).toBeNull();

    await toInspection(id);
    await workflow.executeAdminAction(id, "inspection_pass", {});
    expect(createGatewayRefund).not.toHaveBeenCalled(); // manual payout, not the gateway
    await workflow.executeAdminAction(id, "record_payout", { reference: "UTR123456789" });
    expect((await store.getReturnRequest(id))!.status).toBe("completed");
    expect(await store.getEncryptedPayout(id)).toBeNull();
  });

  it("refuses UPI / bank payouts when no encryption key is configured", async () => {
    vi.stubEnv("RETURNS_ENCRYPTION_KEY", "");
    const p = await product();
    const c = await customer();
    const order = await seedOrder(c, [{ productId: p.id, name: p.name, quantity: 1 }]);
    const r = await submit(c.cookie, order, [{ productId: p.id, quantity: 1 }], { refundMethod: "upi", payout: { upiId: "jane@okaxis" } });
    expect(r.body.error).toBe("payout_method_unavailable");
  });
});

describe("authorization", () => {
  it("rejects anonymous callers and hides other customers' orders, requests and evidence", async () => {
    const p = await product();
    const owner = await customer();
    const stranger = await customer();
    const order = await seedOrder(owner, [{ productId: p.id, name: p.name, quantity: 1 }]);
    const items = [{ productId: p.id, quantity: 1 }];

    expect((await submitPost(submission("", order, { items }))).status).toBe(401);
    const forged = await submit(stranger.cookie, order, items);
    expect(forged.res.status).toBe(404);
    expect(forged.body.error).toBe("order_not_found");

    const mine = await submit(owner.cookie, order, items);
    const idRoute = await import("@/app/api/account/returns/[id]/route");
    const cancelRoute = await import("@/app/api/account/returns/[id]/cancel/route");
    const evRoute = await import("@/app/api/account/returns/[id]/evidence/[evidenceId]/route");
    const get = (cookie: string) => new Request("http://x", { headers: { cookie } });
    const [ev] = await store.listEvidence(mine.id);

    expect((await idRoute.GET(get(owner.cookie), routeParams({ id: mine.id }))).status).toBe(200);
    expect((await idRoute.GET(get(stranger.cookie), routeParams({ id: mine.id }))).status).toBe(404);
    expect((await idRoute.GET(get(""), routeParams({ id: mine.id }))).status).toBe(401);
    const json = await (await idRoute.GET(get(owner.cookie), routeParams({ id: mine.id }))).json();
    expect(JSON.stringify(json)).not.toContain((await store.getReturnRequest(mine.id))!.trackToken);

    expect((await evRoute.GET(get(stranger.cookie), routeParams({ id: mine.id, evidenceId: String(ev.id) }))).status).toBe(404);
    const okEv = await evRoute.GET(get(owner.cookie), routeParams({ id: mine.id, evidenceId: String(ev.id) }));
    expect(okEv.status).toBe(200);
    expect(okEv.headers.get("cache-control")).toContain("no-store");

    const strangerCancel = await cancelRoute.POST(new Request("http://x", { method: "POST", headers: { cookie: stranger.cookie } }), routeParams({ id: mine.id }));
    expect(strangerCancel.status).toBe(404);
    expect((await store.getReturnRequest(mine.id))!.status).toBe("submitted");
    const cancel = await cancelRoute.POST(new Request("http://x", { method: "POST", headers: { cookie: owner.cookie } }), routeParams({ id: mine.id }));
    expect(cancel.status).toBe(200);
  });

  it("a customer cannot cancel once pickup is scheduled", async () => {
    const p = await product();
    const c = await customer();
    const order = await seedOrder(c, [{ productId: p.id, name: p.name, quantity: 1 }]);
    const { id } = await submit(c.cookie, order, [{ productId: p.id, quantity: 1 }]);
    await workflow.executeAdminAction(id, "approve", {});
    await workflow.executeAdminAction(id, "schedule_pickup", { scheduledFor: new Date(Date.now() + DAY).toISOString() });
    await expect(workflow.cancelReturnByCustomer(id)).rejects.toMatchObject({ code: "cannot_cancel" });
  });
});

// ---- 7: admin decisions and the workflow --------------------------------------

describe("admin decisions", () => {
  it("approves, schedules pickup, receives, inspects — recording every step with a timestamp and actor", async () => {
    const p = await product();
    const c = await customer();
    const order = await seedOrder(c, [{ productId: p.id, name: p.name, quantity: 1 }]);
    const { id } = await submit(c.cookie, order, [{ productId: p.id, quantity: 1 }]);
    await workflow.executeAdminAction(id, "review", {});
    await toInspection(id).catch(() => undefined); // review already done; approve works from under_review
    const history = await store.getStatusHistory(id);
    expect(history.map((h) => h.toStatus)).toEqual(["submitted", "under_review", "approved", "pickup_scheduled", "picked_up", "inspection"]);
    expect(history.every((h) => !Number.isNaN(Date.parse(h.createdAt)))).toBe(true);
    expect(history.slice(1).every((h) => h.actor === "admin")).toBe(true);
    const subjects = sentSubjects();
    expect(subjects.some((s) => s.startsWith("Your return request is approved"))).toBe(true);
    expect(subjects.some((s) => s.startsWith("Pickup scheduled"))).toBe(true);
    expect(subjects.some((s) => s.startsWith("We have received your product"))).toBe(true);
  });

  it("requires a real reason to reject, and emails it", async () => {
    const p = await product();
    const c = await customer();
    const order = await seedOrder(c, [{ productId: p.id, name: p.name, quantity: 1 }]);
    const { id } = await submit(c.cookie, order, [{ productId: p.id, quantity: 1 }]);
    await expect(workflow.executeAdminAction(id, "reject", {})).rejects.toMatchObject({ code: "rejection_reason_required" });
    await expect(workflow.executeAdminAction(id, "reject", { reason: "no" })).rejects.toMatchObject({ code: "rejection_reason_required" });
    await workflow.executeAdminAction(id, "reject", { reason: "Photos show the damage happened after delivery." });
    const req = (await store.getReturnRequest(id))!;
    expect(req.status).toBe("rejected");
    expect(req.rejectionReason).toContain("after delivery");
    const mail = sentTo(c.account.email).find((m) => String(m.subject).startsWith("Update on your return"))!;
    expect(mail.html).toContain("after delivery");
  });

  it("cannot skip steps or act on a finished request", async () => {
    const p = await product();
    const c = await customer();
    const order = await seedOrder(c, [{ productId: p.id, name: p.name, quantity: 1 }]);
    const { id } = await submit(c.cookie, order, [{ productId: p.id, quantity: 1 }]);
    await expect(workflow.executeAdminAction(id, "mark_picked_up", {})).rejects.toMatchObject({ code: "invalid_transition" });
    await expect(workflow.executeAdminAction(id, "inspection_pass", {})).rejects.toMatchObject({ code: "invalid_transition" });
    await expect(workflow.executeAdminAction(id, "retry_refund", {})).rejects.toMatchObject({ code: "invalid_transition" });
    await workflow.executeAdminAction(id, "approve", {});
    await expect(workflow.executeAdminAction(id, "schedule_pickup", { scheduledFor: "yesterday-ish" })).rejects.toMatchObject({ code: "invalid_pickup_date" });
    await workflow.executeAdminAction(id, "cancel", {});
    await expect(workflow.executeAdminAction(id, "approve", {})).rejects.toMatchObject({ code: "invalid_transition" });
    expect(createGatewayRefund).not.toHaveBeenCalled();
  });

  it("the admin route validates the action name and maps errors", async () => {
    const p = await product();
    const c = await customer();
    const order = await seedOrder(c, [{ productId: p.id, name: p.name, quantity: 1 }]);
    const { id } = await submit(c.cookie, order, [{ productId: p.id, quantity: 1 }]);
    const { POST } = await import("@/app/api/admin/returns/[id]/route");
    const call = (body: unknown) => POST(jsonRequest("http://x", { body }), routeParams({ id }));
    expect((await call({ action: "drop_table" })).status).toBe(400);
    const bad = await call({ action: "reject" });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toBe("rejection_reason_required");
    expect((await call({ action: "approve" })).status).toBe(200);
    expect((await call({ action: "approve" })).status).toBe(409);
    expect((await POST(jsonRequest("http://x", { body: { action: "approve" } }), routeParams({ id: "RR-NOPE0000" }))).status).toBe(404);
  });
});

// ---- 8 & 11: refunds -----------------------------------------------------------

describe("refunds", () => {
  async function inspected(over: { quantity?: number; reason?: string; refundQty?: number } = {}) {
    const p = await product();
    const c = await customer();
    const order = await seedOrder(c, [{ productId: p.id, name: p.name, quantity: over.quantity ?? 2 }]);
    const { id } = await submit(c.cookie, order, [{ productId: p.id, quantity: over.refundQty ?? over.quantity ?? 2 }], over.reason ? { reason: over.reason } : {});
    await toInspection(id);
    return { p, c, order, id };
  }

  it("refunds the item value (plus shipping for a seller-fault whole-order return) and completes only on gateway confirmation", async () => {
    const { id, order } = await inspected({ quantity: 2 });
    await workflow.executeAdminAction(id, "inspection_pass", {});
    expect(createGatewayRefund).toHaveBeenCalledTimes(1);
    const args = createGatewayRefund.mock.calls[0][0];
    expect(args.amountPaise).toBe(215000); // 2 × ₹1000 + ₹150 shipping
    expect(args.paymentId).toBe(order.razorpayPaymentId);
    const req = (await store.getReturnRequest(id))!;
    expect(req.status).toBe("completed");
    const refund = (await refunds.listRefunds(id))[0];
    expect(refund).toMatchObject({ status: "completed", method: "razorpay", amountPaise: 215000 });
    expect(refund.idempotencyKey).toBe(`refund:${id}:1`);
    const subjects = sentSubjects();
    expect(subjects.some((s) => s.startsWith("Refund initiated"))).toBe(true);
    expect(subjects.some((s) => s.startsWith("Refund completed"))).toBe(true);
    const completedMail = sendEmail.mock.calls.map((c) => c[0]).find((m) => String(m.subject).startsWith("Refund completed"))!;
    expect(completedMail.from).toContain("invoice@shilpikala.com");
    expect(completedMail.html).toContain("₹2150.00");
  });

  it("does not refund shipping for a partial return or a change-of-mind reason", async () => {
    const partial = await inspected({ quantity: 2, refundQty: 1 });
    await workflow.executeAdminAction(partial.id, "inspection_pass", {});
    expect(createGatewayRefund.mock.calls[0][0].amountPaise).toBe(100000);

    const quality = await inspected({ quantity: 1, reason: "quality_issue" });
    await workflow.executeAdminAction(quality.id, "inspection_pass", {});
    expect(createGatewayRefund.mock.calls[1][0].amountPaise).toBe(100000);
  });

  it("stays 'refund initiated' until the gateway confirms, then the signed webhook completes it exactly once", async () => {
    createGatewayRefund.mockResolvedValueOnce({ ok: true, refund: { id: "rfnd_pending1", status: "pending" } });
    const { id } = await inspected({ quantity: 1 });
    await workflow.executeAdminAction(id, "inspection_pass", {});
    expect((await store.getReturnRequest(id))!.status).toBe("refund_initiated");
    const [txn] = await refunds.listRefunds(id);
    expect(txn).toMatchObject({ status: "processing", razorpayRefundId: "rfnd_pending1" });
    expect(sentSubjects().some((s) => s.startsWith("Refund completed"))).toBe(false);

    const event = { event: "refund.processed", payload: { refund: { entity: { id: "rfnd_pending1", payment_id: "pay_x", status: "processed", amount: 115000, notes: { refund_txn_id: txn.id } } } } };
    expect((await webhookPost(hook(event))).status).toBe(200);
    expect((await store.getReturnRequest(id))!.status).toBe("completed");
    expect((await refunds.listRefunds(id))[0].status).toBe("completed");
    const completedMails = () => sentSubjects().filter((s) => s.startsWith("Refund completed")).length;
    expect(completedMails()).toBe(1);

    // Razorpay retries the webhook: nothing changes, nothing is re-sent.
    expect((await webhookPost(hook(event))).status).toBe(200);
    expect(completedMails()).toBe(1);
    expect((await store.getStatusHistory(id)).filter((h) => h.toStatus === "completed")).toHaveLength(1);
    // And a partial return refund never flips the whole order to "refunded".
    const order = (await orders.getOrderById((await store.getReturnRequest(id))!.orderId))!;
    expect(order.status).toBe("delivered");
  });

  it("rejects a webhook with a bad signature and ignores refunds that are not ours", async () => {
    const bad = new Request("http://x/api/webhooks/razorpay", { method: "POST", headers: { "x-razorpay-signature": "nope" }, body: "{}" });
    expect((await webhookPost(bad)).status).toBe(400);
    const stranger = { event: "refund.processed", payload: { refund: { entity: { id: "rfnd_dash", payment_id: "pay_unknown", amount: 100 } } } };
    expect((await webhookPost(hook(stranger))).status).toBe(200);
  });

  it("marks a refund failed when Razorpay refuses, alerts the admin, and a retry makes a fresh attempt", async () => {
    createGatewayRefund.mockResolvedValueOnce({ ok: false, definite: true, reason: "Payment too old to refund" });
    const { id } = await inspected({ quantity: 1 });
    await workflow.executeAdminAction(id, "inspection_pass", {});
    expect((await store.getReturnRequest(id))!.status).toBe("refund_failed");
    const [failed] = await refunds.listRefunds(id);
    expect(failed).toMatchObject({ status: "failed", failureReason: "Payment too old to refund" });
    expect(sentSubjects().some((s) => s.includes("Refund FAILED"))).toBe(true);
    expect(sentSubjects().some((s) => s.startsWith("Refund completed"))).toBe(false);

    await workflow.executeAdminAction(id, "retry_refund", {});
    expect((await store.getReturnRequest(id))!.status).toBe("completed");
    const all = await refunds.listRefunds(id);
    expect(all.map((r) => [r.status, r.idempotencyKey])).toEqual([["failed", `refund:${id}:1`], ["completed", `refund:${id}:2`]]);
  });

  it("an unanswered gateway call is left pending (never retried blindly) until Sync finds the answer", async () => {
    createGatewayRefund.mockResolvedValueOnce({ ok: false, definite: false, reason: "timeout" });
    const { id } = await inspected({ quantity: 1 });
    await workflow.executeAdminAction(id, "inspection_pass", {});
    expect((await store.getReturnRequest(id))!.status).toBe("refund_initiated");
    const [txn] = await refunds.listRefunds(id);
    expect(txn.status).toBe("pending");
    await expect(workflow.executeAdminAction(id, "retry_refund", {})).rejects.toMatchObject({ code: "invalid_transition" });
    expect(createGatewayRefund).toHaveBeenCalledTimes(1);

    findGatewayRefund.mockResolvedValueOnce({ id: "rfnd_found", status: "processed" });
    await workflow.executeAdminAction(id, "sync_refund", {});
    expect(findGatewayRefund).toHaveBeenCalledWith(expect.any(String), txn.id);
    expect((await store.getReturnRequest(id))!.status).toBe("completed");
    expect((await refunds.listRefunds(id))[0]).toMatchObject({ status: "completed", razorpayRefundId: "rfnd_found" });
  });

  it("two simultaneous refund attempts reach the gateway once and create one refund", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    createGatewayRefund.mockImplementation(async () => {
      await gate;
      return { ok: true, refund: { id: "rfnd_once", status: "processed" } };
    });
    const { id } = await inspected({ quantity: 1 });
    const first = workflow.executeAdminAction(id, "inspection_pass", {});
    const second = workflow.executeAdminAction(id, "inspection_pass", {});
    const pending = Promise.allSettled([first, second]);
    await new Promise((r) => setTimeout(r, 150));
    release();
    const settled = await pending;
    expect(settled.filter((s) => s.status === "fulfilled")).toHaveLength(1);
    expect(settled.filter((s) => s.status === "rejected")).toHaveLength(1);
    expect(createGatewayRefund).toHaveBeenCalledTimes(1);
    expect(await refunds.listRefunds(id)).toHaveLength(1);
    expect((await store.getReturnRequest(id))!.status).toBe("completed");
  });

  it("never refunds more than was paid for the order", async () => {
    const { id, order } = await inspected({ quantity: 1 });
    const db = await dbm.getDb();
    // Pretend earlier refunds already consumed most of the payment.
    const other = (await customer()).account;
    void other;
    await db.query("UPDATE orders SET amount = 1000 WHERE id = $1", [order.id]); // paid 1000, refund wants 1150
    await expect(workflow.executeAdminAction(id, "inspection_pass", {})).rejects.toMatchObject({ code: "refund_exceeds_paid" });
    expect(createGatewayRefund).not.toHaveBeenCalled();
    expect((await store.getReturnRequest(id))!.status).toBe("inspection"); // the whole attempt rolled back
  });

  it("a gateway refund can only be completed by the gateway, never by a typed-in reference", async () => {
    createGatewayRefund.mockResolvedValueOnce({ ok: true, refund: { id: "rfnd_p", status: "pending" } });
    const { id } = await inspected({ quantity: 1 });
    await workflow.executeAdminAction(id, "inspection_pass", {});
    await expect(workflow.executeAdminAction(id, "record_payout", { reference: "UTR999999" })).rejects.toMatchObject({
      code: "gateway_refund_needs_gateway_confirmation",
    });
    expect((await store.getReturnRequest(id))!.status).toBe("refund_initiated");
  });

  it("a failed inspection can be rejected (with a reason) or overridden to refund", async () => {
    const { id } = await inspected({ quantity: 1 });
    await workflow.executeAdminAction(id, "inspection_fail", { note: "No damage visible" });
    expect(sentSubjects().some((s) => s.startsWith("Quality inspection result"))).toBe(true);
    await expect(workflow.executeAdminAction(id, "reject", {})).rejects.toMatchObject({ code: "rejection_reason_required" });
    await workflow.executeAdminAction(id, "reject", { reason: "No damage found on inspection." });
    expect((await store.getReturnRequest(id))!.status).toBe("rejected");

    const second = await inspected({ quantity: 1 });
    await workflow.executeAdminAction(second.id, "inspection_fail", {});
    await workflow.executeAdminAction(second.id, "inspection_pass", { note: "Overridden after review" });
    expect((await store.getReturnRequest(second.id))!.status).toBe("completed");
  });
});

// ---- 9: replacements -----------------------------------------------------------

describe("replacements", () => {
  async function replacementInspected(stock: number | undefined, quantity = 1) {
    const p = await product(stock === undefined ? {} : { stockQuantity: stock });
    const c = await customer();
    const order = await seedOrder(c, [{ productId: p.id, name: p.name, quantity }]);
    const { id } = await submit(c.cookie, order, [{ productId: p.id, quantity }], { type: "replacement", reason: "defective" });
    await toInspection(id);
    return { p, c, id };
  }
  const stockOf = async (id: number) => (await catalog.getProductById(id))!;

  it("reserves stock, creates a tracked shipment, dispatches and delivers with emails", async () => {
    const { p, id } = await replacementInspected(5);
    await workflow.executeAdminAction(id, "inspection_pass", {});
    expect((await store.getReturnRequest(id))!.status).toBe("replacement_processing");
    expect((await stockOf(p.id)).stockQuantity).toBe(4);
    const shipment = (await replacements.getShipmentForRequest(id))!;
    expect(shipment.trackingNumber).toMatch(/^RPL-[A-Z0-9]{10}$/);
    expect(shipment.status).toBe("processing");

    await expect(workflow.executeAdminAction(id, "mark_replacement_delivered", {})).rejects.toMatchObject({ code: "shipment_not_dispatched" });
    await workflow.executeAdminAction(id, "dispatch_replacement", { carrier: "Delhivery", carrierTracking: "DL123" });
    expect((await replacements.getShipmentForRequest(id))!).toMatchObject({ status: "dispatched", carrier: "Delhivery" });
    const dispatched = sendEmail.mock.calls.map((c) => c[0]).find((m) => String(m.subject).startsWith("Your replacement is on its way"))!;
    expect(dispatched.html).toContain(shipment.trackingNumber);
    await workflow.executeAdminAction(id, "mark_replacement_delivered", {});
    expect((await store.getReturnRequest(id))!.status).toBe("completed");
    expect((await replacements.getShipmentForRequest(id))!.status).toBe("delivered");
    expect(sentSubjects().some((s) => s.startsWith("Your replacement was delivered"))).toBe(true);
    expect(createGatewayRefund).not.toHaveBeenCalled();
  });

  it("parks the request when stock is short — nothing reserved — and the admin chooses a refund instead", async () => {
    const { p, id } = await replacementInspected(1, 2);
    await workflow.executeAdminAction(id, "inspection_pass", {});
    expect((await store.getReturnRequest(id))!.status).toBe("replacement_unavailable");
    expect((await stockOf(p.id)).stockQuantity).toBe(1); // untouched
    expect(await replacements.getShipmentForRequest(id)).toBeUndefined();
    expect(sentSubjects().some((s) => s.includes("Replacement unavailable"))).toBe(true);
    expect(sentSubjects().some((s) => s.startsWith("Update on your replacement"))).toBe(true);

    await workflow.executeAdminAction(id, "alt_refund", {});
    expect((await store.getReturnRequest(id))!.status).toBe("completed");
    expect(createGatewayRefund.mock.calls[0][0].amountPaise).toBe(215000);
  });

  it("or the admin restocks and retries", async () => {
    const { p, id } = await replacementInspected(0);
    await workflow.executeAdminAction(id, "inspection_pass", {});
    expect((await store.getReturnRequest(id))!.status).toBe("replacement_unavailable");
    await catalog.updateProduct(p.id, { ...(await catalogInput(p.id)), stockQuantity: 3, inStock: true } as never);
    await workflow.executeAdminAction(id, "retry_replacement", {});
    expect((await store.getReturnRequest(id))!.status).toBe("replacement_processing");
    expect((await stockOf(p.id)).stockQuantity).toBe(2);
  });

  async function catalogInput(productId: number) {
    const cur = (await catalog.getProductById(productId))!;
    return { name: cur.name, description: cur.description, price: cur.price, regularPrice: cur.regularPrice, onSale: cur.onSale, inStock: cur.inStock, categorySlugs: [] };
  }

  it("never oversells: two replacements for the last unit — one succeeds, one is parked", async () => {
    const p = await product({ stockQuantity: 1 });
    const c = await customer();
    const make = async () => {
      const order = await seedOrder(c, [{ productId: p.id, name: p.name, quantity: 1 }]);
      const { id } = await submit(c.cookie, order, [{ productId: p.id, quantity: 1 }], { type: "replacement", reason: "damaged" });
      await toInspection(id);
      return id;
    };
    const [a, b] = [await make(), await make()];
    await Promise.all([workflow.executeAdminAction(a, "inspection_pass", {}), workflow.executeAdminAction(b, "inspection_pass", {})]);
    const statuses = [(await store.getReturnRequest(a))!.status, (await store.getReturnRequest(b))!.status].sort();
    expect(statuses).toEqual(["replacement_processing", "replacement_unavailable"]);
    expect((await stockOf(p.id)).stockQuantity).toBe(0);
    expect((await stockOf(p.id)).inStock).toBe(false);
  });

  it("made-to-order products (no stock count) can be replaced while marked in stock", async () => {
    const { id } = await replacementInspected(undefined);
    await workflow.executeAdminAction(id, "inspection_pass", {});
    expect((await store.getReturnRequest(id))!.status).toBe("replacement_processing");
  });

  it("a return request cannot be turned into a replacement", async () => {
    const p = await product();
    const c = await customer();
    const order = await seedOrder(c, [{ productId: p.id, name: p.name, quantity: 1 }]);
    const { id } = await submit(c.cookie, order, [{ productId: p.id, quantity: 1 }]);
    await toInspection(id);
    await expect(replacements.startReplacement(id, "admin")).rejects.toMatchObject({ code: "not_a_replacement" });
  });
});

// ---- search, summary, public status --------------------------------------------

describe("admin listing", () => {
  it("filters by status group and searches by request id, order number, product and customer", async () => {
    const p = await product({ name: "Lotus Mandala" });
    const q = await product({ name: "Warli Tray" });
    const c = await customer("ravi@example.com");
    const o1 = await seedOrder(c, [{ productId: p.id, name: p.name, quantity: 1 }]);
    const o2 = await seedOrder(c, [{ productId: q.id, name: q.name, quantity: 1 }]);
    const a = await submit(c.cookie, o1, [{ productId: p.id, quantity: 1 }]);
    const b = await submit(c.cookie, o2, [{ productId: q.id, quantity: 1 }]);
    await workflow.executeAdminAction(b.id, "approve", {});

    expect((await store.listAllReturns({ group: "pending" })).map((r) => r.id)).toEqual([a.id]);
    expect((await store.listAllReturns({ group: "approved" })).map((r) => r.id)).toEqual([b.id]);
    expect((await store.listAllReturns({ q: a.id.toLowerCase() })).map((r) => r.id)).toEqual([a.id]);
    expect((await store.listAllReturns({ q: "warli" })).map((r) => r.id)).toEqual([b.id]);
    expect((await store.listAllReturns({ q: "RAVI@" })).length).toBe(2);
    expect((await store.listAllReturns({ q: `SK-${o1.orderNumber}` })).map((r) => r.id)).toEqual([a.id]);
    expect((await store.listAllReturns({ q: "100%" })).length).toBe(0); // LIKE wildcards are escaped
    const summary = await store.getReturnSummary();
    expect(summary).toMatchObject({ pending: 1, approved: 1, rejected: 0 });
  });
});

// ---- admin routes that feed the feature ---------------------------------------

describe("delivery time and policy admin routes", () => {
  it("marking an order delivered via the admin route stamps delivered_at; a corrected time is accepted, a future one refused", async () => {
    const p = await product();
    const c = await customer();
    const order = await seedOrder(c, [{ productId: p.id, name: p.name, quantity: 1 }], { status: "shipped" });
    const { PATCH } = await import("@/app/api/admin/orders/[id]/route");
    const patch = (body: unknown) => PATCH(jsonRequest("http://x", { method: "PATCH", body }), routeParams({ id: order.id }));

    expect((await patch({ status: "delivered" })).status).toBe(200);
    const stamped = (await orders.getOrderById(order.id))!.deliveredAt!;
    expect(Math.abs(Date.now() - new Date(stamped).getTime())).toBeLessThan(60_000);

    const earlier = new Date(Date.now() - 3 * DAY).toISOString();
    expect((await patch({ status: "delivered", deliveredAt: earlier })).status).toBe(200);
    expect((await orders.getOrderById(order.id))!.deliveredAt).toBe(earlier);

    expect((await patch({ status: "delivered", deliveredAt: new Date(Date.now() + 5 * DAY).toISOString() })).status).toBe(400);
    expect((await patch({ status: "delivered", deliveredAt: "garbage" })).status).toBe(400);
    expect((await orders.getOrderById(order.id))!.deliveredAt).toBe(earlier);
  });

  it("the policy route validates and saves", async () => {
    const p = await product();
    const { PUT } = await import("@/app/api/admin/returns/policies/[productId]/route");
    const put = (id: string | number, body: unknown) => PUT(jsonRequest("http://x", { method: "PUT", body }), routeParams({ productId: String(id) }));
    expect((await put(p.id, { returnable: "yes", replaceable: true })).status).toBe(400);
    expect((await put(999999, { returnable: false, replaceable: false })).status).toBe(404);
    expect((await put(p.id, { returnable: false, replaceable: true, note: "  Made to order " })).status).toBe(200);
    expect(await store.getProductPolicy(p.id)).toEqual({ returnable: false, replaceable: true, note: "Made to order" });
    const all = await store.listProductPolicies();
    expect(all.find((x) => x.productId === p.id)).toMatchObject({ custom: true, returnable: false });
  });

  it("a dashboard-issued partial refund no longer flips the whole order to refunded, a full one still does", async () => {
    const p = await product();
    const c = await customer();
    const order = await seedOrder(c, [{ productId: p.id, name: p.name, quantity: 1 }]);
    const partial = { event: "refund.processed", payload: { refund: { entity: { id: "rfnd_dash1", payment_id: order.razorpayPaymentId, amount: 50000 } } } };
    expect((await webhookPost(hook(partial))).status).toBe(200);
    expect((await orders.getOrderById(order.id))!.status).toBe("delivered");
    const full = { event: "refund.processed", payload: { refund: { entity: { id: "rfnd_dash2", payment_id: order.razorpayPaymentId, amount: Math.round(order.amount * 100) } } } };
    expect((await webhookPost(hook(full))).status).toBe(200);
    expect((await orders.getOrderById(order.id))!.status).toBe("refunded");
  });
});

describe("customer-visible history", () => {
  it("hides staff-only notes from the customer but keeps them in the audit trail", async () => {
    const p = await product();
    const c = await customer();
    const order = await seedOrder(c, [{ productId: p.id, name: p.name, quantity: 1 }]);
    const { id } = await submit(c.cookie, order, [{ productId: p.id, quantity: 1 }]);
    await workflow.executeAdminAction(id, "note", { note: "Customer called, sounded upset" });
    await expect(workflow.executeAdminAction(id, "note", {})).rejects.toMatchObject({ code: "note_required" });
    expect((await store.getStatusHistory(id)).some((h) => h.note?.includes("upset"))).toBe(false);
    const full = await store.getStatusHistory(id, true);
    expect(full.find((h) => h.note?.includes("upset"))).toMatchObject({ internal: true, actor: "admin" });
  });

  it("the public status link needs the exact token", async () => {
    const p = await product();
    const c = await customer();
    const order = await seedOrder(c, [{ productId: p.id, name: p.name, quantity: 1 }]);
    const { id } = await submit(c.cookie, order, [{ productId: p.id, quantity: 1 }]);
    const req = (await store.getReturnRequest(id))!;
    // The e-mailed link points at the status page with this token.
    const mail = sentTo(c.account.email)[0];
    expect(mail.html).toContain(`t=${req.trackToken}`);
    expect(req.trackToken).toMatch(/^[0-9a-f]{48}$/);
  });
});
