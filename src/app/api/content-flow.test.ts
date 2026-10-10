import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isolateStorageDir } from "@/test-support/tempStorageDir";
import { jsonRequest, routeParams } from "@/test-support/request";

const sendEmail = vi.hoisted(() => vi.fn().mockResolvedValue(true));
vi.mock("@/lib/email/send", () => ({ sendEmail }));

let cleanup: () => void;
let n = 0;
const ip = () => `203.0.113.${++n % 250}`;

beforeEach(() => {
  cleanup = isolateStorageDir();
  sendEmail.mockClear();
  vi.stubEnv("RESEND_API_KEY", "k");
  vi.stubEnv("EMAIL_FROM", "a@b.co");
  vi.stubEnv("ADMIN_NOTIFICATION_EMAIL", "owner@example.com");
});
afterEach(() => {
  vi.unstubAllEnvs();
  cleanup();
});

describe("POST /api/inquiries", () => {
  const good = { kind: "contact", name: "Asha", email: "asha@example.com", message: "Hello, do you ship abroad?" };

  async function post(body: unknown, address = ip()) {
    const { POST } = await import("@/app/api/inquiries/route");
    return POST(jsonRequest("http://x/api/inquiries", { ip: address, body }));
  }

  it("stores a valid inquiry and alerts the owner", async () => {
    const res = await post(good);
    expect(res.status).toBe(201);
    const store = await import("@/lib/inquiries/store");
    const all = await store.listInquiries();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ kind: "contact", status: "new", email: "asha@example.com" });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].to).toBe("owner@example.com");
  });

  it("escapes HTML in the owner alert (no markup injection)", async () => {
    await post({ ...good, name: "<script>alert(1)</script>" });
    expect(sendEmail.mock.calls[0][0].html).not.toContain("<script>");
  });

  it("silently drops honeypot submissions: success response, nothing stored or sent", async () => {
    const res = await post({ ...good, website: "http://spam.example" });
    expect(res.status).toBe(201);
    const store = await import("@/lib/inquiries/store");
    expect(await store.listInquiries()).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it.each([
    [{ ...good, kind: "other" }, "invalid_kind"],
    [{ ...good, email: "bad" }, "invalid_email"],
    [{ ...good, name: "" }, "invalid_name"],
    [{ ...good, message: "hi" }, "message_too_short"],
  ])("rejects %j", async (body, error) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(error);
  });

  it("keeps only known custom-art fields in details", async () => {
    await post({ ...good, kind: "custom-art", style: "Mandala", size: "24x24", evil: "x".repeat(50) });
    const store = await import("@/lib/inquiries/store");
    const [inq] = await store.listInquiries();
    expect(inq.details).toEqual({ style: "Mandala", size: "24x24" });
  });

  it("rate-limits one IP", async () => {
    let last = 0;
    for (let i = 0; i < 7; i++) last = (await post(good, "192.0.2.50")).status;
    expect(last).toBe(429);
  });

  it("admin can move an inquiry through its statuses", async () => {
    await post(good);
    const store = await import("@/lib/inquiries/store");
    const [inq] = await store.listInquiries();
    const { PATCH } = await import("@/app/api/admin/inquiries/[id]/route");
    const ok = await PATCH(jsonRequest("http://x", { method: "PATCH", body: { status: "replied" } }), routeParams({ id: String(inq.id) }));
    expect(ok.status).toBe(200);
    const bad = await PATCH(jsonRequest("http://x", { method: "PATCH", body: { status: "bogus" } }), routeParams({ id: String(inq.id) }));
    expect(bad.status).toBe(400);
    const missing = await PATCH(jsonRequest("http://x", { method: "PATCH", body: { status: "closed" } }), routeParams({ id: "9999" }));
    expect(missing.status).toBe(404);
  });
});

describe("blog", () => {
  const post = { title: "Making a Mandala", excerpt: "Notes", body: "Para one.\n\nPara two.", published: false };

  it("drafts are hidden from the public until published; slugs stay unique", async () => {
    const { POST } = await import("@/app/api/admin/blog/route");
    const store = await import("@/lib/blog/store");

    const a = await (await POST(jsonRequest("http://x", { body: post }))).json();
    const b = await (await POST(jsonRequest("http://x", { body: post }))).json();
    expect(a.post.slug).toBe("making-a-mandala");
    expect(b.post.slug).toBe("making-a-mandala-2");
    expect(await store.listPublishedPosts()).toHaveLength(0);
    expect(await store.getPublishedPostBySlug("making-a-mandala")).toBeUndefined();

    const { PATCH } = await import("@/app/api/admin/blog/[id]/route");
    const res = await PATCH(
      jsonRequest("http://x", { method: "PATCH", body: { ...post, published: true } }),
      routeParams({ id: String(a.post.id) })
    );
    expect(res.status).toBe(200);
    const published = await store.listPublishedPosts();
    expect(published).toHaveLength(1);
    expect(published[0].publishedAt).toBeDefined();
  });

  it("keeps the original publish date when edited later", async () => {
    const store = await import("@/lib/blog/store");
    const created = await store.createPost({ ...post, published: true });
    const edited = await store.updatePost(created.id, { ...post, title: "Renamed", published: true });
    expect(edited?.publishedAt).toBe(created.publishedAt);
    expect(edited?.slug).toBe(created.slug);
  });

  it("validates input and handles missing posts", async () => {
    const { POST } = await import("@/app/api/admin/blog/route");
    expect((await POST(jsonRequest("http://x", { body: { ...post, title: "" } }))).status).toBe(400);
    expect((await POST(jsonRequest("http://x", { body: { ...post, published: "yes" } }))).status).toBe(400);
    const { DELETE } = await import("@/app/api/admin/blog/[id]/route");
    const res = await DELETE(new Request("http://x", { method: "DELETE" }), routeParams({ id: "999" }));
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/admin/orders/[id]", () => {
  const base = {
    id: "ord-1", razorpayOrderId: "r1", razorpayPaymentId: "p1", itemsSubtotal: 100, shipping: 0, amount: 100,
    currency: "INR" as const, customerEmail: "c@example.com",
    address: { fullName: "C", line1: "a", city: "b", state: "c", postalCode: "1", country: "India" },
    items: [], status: "paid" as const, createdAt: new Date().toISOString(),
  };

  async function setup() {
    const orders = await import("@/lib/orders/store");
    await orders.appendOrder(base);
    const { PATCH } = await import("@/app/api/admin/orders/[id]/route");
    return { orders, patch: (body: unknown) => PATCH(jsonRequest("http://x", { method: "PATCH", body }), routeParams({ id: "ord-1" })) };
  }

  it("updates status and tracking, and emails the customer exactly once on 'shipped'", async () => {
    const { orders, patch } = await setup();
    const res = await patch({ status: "shipped", trackingNumber: " AB123 ", carrier: "India Post" });
    expect(res.status).toBe(200);
    const o = await orders.getOrderById("ord-1");
    expect(o).toMatchObject({ status: "shipped", trackingNumber: "AB123", carrier: "India Post" });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].to).toBe("c@example.com");

    await patch({ status: "shipped" });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("does not email for non-shipping transitions", async () => {
    const { patch } = await setup();
    await patch({ status: "processing" });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("rejects unknown statuses and unknown orders", async () => {
    const { patch } = await setup();
    expect((await patch({ status: "teleported" })).status).toBe(400);
    const { PATCH } = await import("@/app/api/admin/orders/[id]/route");
    const res = await PATCH(jsonRequest("http://x", { method: "PATCH", body: { status: "paid" } }), routeParams({ id: "nope" }));
    expect(res.status).toBe(404);
  });

  it("can clear a tracking number", async () => {
    const { orders, patch } = await setup();
    await patch({ trackingNumber: "X1" });
    await patch({ trackingNumber: "" });
    expect((await orders.getOrderById("ord-1"))?.trackingNumber).toBeUndefined();
  });
});

describe("unreconciled payments", () => {
  it("are logged durably and can be marked resolved", async () => {
    const orders = await import("@/lib/orders/store");
    await orders.recordUnreconciledPayment("order_x", "pay_x", "no snapshot");
    const [p] = await orders.listUnreconciledPayments();
    expect(p).toMatchObject({ razorpayOrderId: "order_x", resolved: false });

    const { POST } = await import("@/app/api/admin/payments/[id]/route");
    const res = await POST(new Request("http://x", { method: "POST" }), routeParams({ id: String(p.id) }));
    expect(res.status).toBe(200);
    expect((await orders.listUnreconciledPayments())[0].resolved).toBe(true);
  });
});
