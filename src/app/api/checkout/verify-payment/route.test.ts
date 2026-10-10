import { createHmac } from "node:crypto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isolateStorageDir } from "@/test-support/tempStorageDir";
import { jsonRequest, malformedJsonRequest } from "@/test-support/request";
import type { PendingOrder } from "@/lib/orders/pendingStore";

const { sendEmail } = vi.hoisted(() => ({ sendEmail: vi.fn() }));

vi.mock("@/lib/email/send", () => ({ sendEmail }));

const URL = "http://localhost/api/checkout/verify-payment";
const SECRET = "verify_test_secret";

const address = {
  fullName: "Jane Doe",
  line1: "1 Test St",
  city: "Bengaluru",
  state: "KA",
  postalCode: "560001",
  country: "India",
};

let cleanup: () => void;
let POST: (request: Request) => Promise<Response>;
let catalog: typeof import("@/lib/store/catalogStore");
let orderStore: typeof import("@/lib/orders/store");
let pendingStore: typeof import("@/lib/orders/pendingStore");

function sign(orderId: string, paymentId: string, secret = SECRET) {
  return createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
}

/** The only thing the browser legitimately sends after paying. */
function verifyBody(orderId = "order_1", paymentId = "pay_1", signature?: string) {
  return {
    razorpayOrderId: orderId,
    razorpayPaymentId: paymentId,
    razorpaySignature: signature ?? sign(orderId, paymentId),
  };
}

function pendingOrder(overrides: Partial<PendingOrder> = {}): PendingOrder {
  return {
    razorpayOrderId: "order_1",
    items: [
      { productId: 1, name: "Snapshot Product", slug: "snapshot-product", quantity: 2, price: "1000.00" },
    ],
    itemsSubtotal: 2000,
    shipping: 150,
    amount: 2150,
    amountInPaise: 215000,
    customerEmail: "jane@example.com",
    address,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function trackedProduct(stockQuantity: number | undefined, price = "1000.00") {
  return catalog.createProduct({
    name: "Tracked Product",
    description: "For verify-payment tests.",
    price,
    regularPrice: price,
    onSale: false,
    inStock: true,
    stockQuantity,
    categorySlugs: [],
  });
}

async function setup(env: { configured?: boolean; adminEmail?: string } = {}) {
  const { configured = true, adminEmail } = env;
  cleanup = isolateStorageDir();
  vi.stubEnv("RAZORPAY_KEY_SECRET", configured ? SECRET : "");
  vi.stubEnv("NEXT_PUBLIC_RAZORPAY_KEY_ID", configured ? "rzp_test_key" : "");
  vi.stubEnv("RESEND_API_KEY", adminEmail ? "re_test" : "");
  vi.stubEnv("EMAIL_FROM", adminEmail ? "Shop <shop@example.com>" : "");
  vi.stubEnv("ADMIN_NOTIFICATION_EMAIL", adminEmail ?? "");
  catalog = await import("@/lib/store/catalogStore");
  orderStore = await import("@/lib/orders/store");
  pendingStore = await import("@/lib/orders/pendingStore");
  ({ POST } = await import("@/app/api/checkout/verify-payment/route"));
}

beforeEach(() => {
  sendEmail.mockReset();
  sendEmail.mockResolvedValue(true);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  cleanup();
});

describe("POST /api/checkout/verify-payment — gatekeeping", () => {
  it("returns 503 when Razorpay isn't configured", async () => {
    await setup({ configured: false });
    expect((await POST(jsonRequest(URL, { body: verifyBody() }))).status).toBe(503);
  });

  it("rejects malformed JSON", async () => {
    await setup();
    expect((await POST(malformedJsonRequest(URL))).status).toBe(400);
  });

  it("rejects a request missing the Razorpay fields", async () => {
    await setup();
    const response = await POST(jsonRequest(URL, { body: { razorpayOrderId: "order_1" } }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "missing_fields" });
  });

  it("rejects a bad signature and records / decrements / emails nothing", async () => {
    await setup();
    const p = await trackedProduct(5);
    await pendingStore.savePendingOrder(
      pendingOrder({ items: [{ productId: p.id, name: p.name, slug: p.slug, quantity: 1, price: "1000.00" }] })
    );

    const response = await POST(
      jsonRequest(URL, { body: verifyBody("order_1", "pay_1", sign("order_1", "pay_1", "attacker")) })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ verified: false });
    expect(await orderStore.getAllOrders()).toHaveLength(0);
    expect((await catalog.getProducts()).find((x) => x.id === p.id)?.stockQuantity).toBe(5);
    expect(sendEmail).not.toHaveBeenCalled();
    // The snapshot must survive a forged attempt so the real payment can still complete.
    expect(await pendingStore.getPendingOrder("order_1")).toBeDefined();
  });

  it("rejects a valid signature replayed against a different order id", async () => {
    await setup();
    await pendingStore.savePendingOrder(pendingOrder({ razorpayOrderId: "order_OTHER" }));
    const response = await POST(
      jsonRequest(URL, { body: verifyBody("order_OTHER", "pay_1", sign("order_1", "pay_1")) })
    );
    expect(response.status).toBe(400);
    expect(await orderStore.getAllOrders()).toHaveLength(0);
  });
});

describe("POST /api/checkout/verify-payment — recording from the snapshot", () => {
  beforeEach(() => setup());

  it("records exactly what was snapshotted and charged", async () => {
    await pendingStore.savePendingOrder(pendingOrder());

    const response = await POST(jsonRequest(URL, { body: verifyBody() }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ verified: true, orderId: "order_1" });

    const [stored] = await orderStore.getAllOrders();
    expect(stored).toMatchObject({
      razorpayOrderId: "order_1",
      razorpayPaymentId: "pay_1",
      itemsSubtotal: 2000,
      shipping: 150,
      amount: 2150,
      status: "paid",
      customerEmail: "jane@example.com",
    });
    expect(stored.items[0]).toMatchObject({ name: "Snapshot Product", quantity: 2, price: "1000.00" });
    expect(stored.address.fullName).toBe("Jane Doe");
  });

  // The attack this redesign closes: pay for a cheap cart, then claim an
  // expensive one at verification time.
  it("IGNORES a cart, address, email or amount the browser claims at verify time", async () => {
    await pendingStore.savePendingOrder(pendingOrder());
    const pricey = await trackedProduct(undefined, "50000.00");

    await POST(
      jsonRequest(URL, {
        body: {
          ...verifyBody(),
          items: [{ productId: pricey.id, quantity: 1 }],
          address: { ...address, fullName: "Someone Else", city: "Elsewhere" },
          email: "attacker@example.com",
          amount: 5000000,
        },
      })
    );

    const [stored] = await orderStore.getAllOrders();
    expect(stored.amount).toBe(2150);
    expect(stored.items).toHaveLength(1);
    expect(stored.items[0].name).toBe("Snapshot Product");
    expect(stored.address.fullName).toBe("Jane Doe");
    expect(stored.customerEmail).toBe("jane@example.com");
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "jane@example.com" }));
    expect(sendEmail).not.toHaveBeenCalledWith(expect.objectContaining({ to: "attacker@example.com" }));
  });

  it("keeps the charged price even if the catalogue price changes before verification", async () => {
    const p = await trackedProduct(undefined, "1000.00");
    await pendingStore.savePendingOrder(
      pendingOrder({ items: [{ productId: p.id, name: p.name, slug: p.slug, quantity: 2, price: "1000.00" }] })
    );

    await catalog.updateProduct(p.id, {
      name: p.name,
      description: p.description,
      price: "9999.00",
      regularPrice: "9999.00",
      onSale: false,
      inStock: true,
      categorySlugs: [],
    });

    await POST(jsonRequest(URL, { body: verifyBody() }));

    const [stored] = await orderStore.getAllOrders();
    expect(stored.items[0].price).toBe("1000.00");
    expect(stored.amount).toBe(2150);
  });

  it("still records a paid order if the product was deleted after checkout began", async () => {
    const p = await trackedProduct(undefined);
    await pendingStore.savePendingOrder(
      pendingOrder({ items: [{ productId: p.id, name: p.name, slug: p.slug, quantity: 1, price: "1000.00" }] })
    );
    await catalog.deleteProduct(p.id);

    const response = await POST(jsonRequest(URL, { body: verifyBody() }));

    expect(response.status).toBe(200);
    expect(await orderStore.getAllOrders()).toHaveLength(1);
  });

  it("still records a paid order if stock ran out in the meantime, clamping stock at zero", async () => {
    const p = await trackedProduct(1);
    await pendingStore.savePendingOrder(
      pendingOrder({ items: [{ productId: p.id, name: p.name, slug: p.slug, quantity: 3, price: "1000.00" }] })
    );

    const response = await POST(jsonRequest(URL, { body: verifyBody() }));

    expect(response.status).toBe(200);
    expect(await orderStore.getAllOrders()).toHaveLength(1);
    const current = (await catalog.getProducts()).find((x) => x.id === p.id)!;
    expect(current.stockQuantity).toBe(0);
    expect(current.inStock).toBe(false);
  });

  it("decrements tracked stock, flipping inStock off at zero", async () => {
    const p = await trackedProduct(3);
    const line = (quantity: number) => [
      { productId: p.id, name: p.name, slug: p.slug, quantity, price: "1000.00" },
    ];
    await pendingStore.savePendingOrder(pendingOrder({ razorpayOrderId: "order_a", items: line(2) }));
    await pendingStore.savePendingOrder(pendingOrder({ razorpayOrderId: "order_b", items: line(1) }));

    await POST(jsonRequest(URL, { body: verifyBody("order_a", "pay_a") }));
    let current = (await catalog.getProducts()).find((x) => x.id === p.id)!;
    expect(current).toMatchObject({ stockQuantity: 1, inStock: true });

    await POST(jsonRequest(URL, { body: verifyBody("order_b", "pay_b") }));
    current = (await catalog.getProducts()).find((x) => x.id === p.id)!;
    expect(current).toMatchObject({ stockQuantity: 0, inStock: false });
  });

  it("leaves untracked products' stock fields alone", async () => {
    const p = await trackedProduct(undefined);
    await pendingStore.savePendingOrder(
      pendingOrder({ items: [{ productId: p.id, name: p.name, slug: p.slug, quantity: 1, price: "1000.00" }] })
    );

    await POST(jsonRequest(URL, { body: verifyBody() }));

    const current = (await catalog.getProducts()).find((x) => x.id === p.id)!;
    expect(current.stockQuantity).toBeUndefined();
    expect(current.inStock).toBe(true);
  });

  it("removes the snapshot once the order is recorded", async () => {
    await pendingStore.savePendingOrder(pendingOrder());
    await POST(jsonRequest(URL, { body: verifyBody() }));
    expect(await pendingStore.getPendingOrder("order_1")).toBeUndefined();
  });

  it("is idempotent: replays record one order, decrement once, email once", async () => {
    const p = await trackedProduct(5);
    await pendingStore.savePendingOrder(
      pendingOrder({ items: [{ productId: p.id, name: p.name, slug: p.slug, quantity: 2, price: "1000.00" }] })
    );

    const first = await POST(jsonRequest(URL, { body: verifyBody() }));
    const second = await POST(jsonRequest(URL, { body: verifyBody() }));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await orderStore.getAllOrders()).toHaveLength(1);
    expect((await catalog.getProducts()).find((x) => x.id === p.id)?.stockQuantity).toBe(3);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "jane@example.com", subject: expect.stringContaining("Order Confirmed") })
    );
  });

  it("only ever uses the snapshot belonging to the paid Razorpay order", async () => {
    await pendingStore.savePendingOrder(pendingOrder({ razorpayOrderId: "order_1" }));
    await pendingStore.savePendingOrder(
      pendingOrder({ razorpayOrderId: "order_2", customerEmail: "other@example.com", amount: 999 })
    );

    await POST(jsonRequest(URL, { body: verifyBody("order_2", "pay_2") }));

    const [stored] = await orderStore.getAllOrders();
    expect(stored.razorpayOrderId).toBe("order_2");
    expect(stored.customerEmail).toBe("other@example.com");
    expect(await pendingStore.getPendingOrder("order_1")).toBeDefined();
  });

  it("skips the customer email when the snapshotted address is invalid, but still records the order", async () => {
    await pendingStore.savePendingOrder(pendingOrder({ customerEmail: "not-an-email" }));

    const response = await POST(jsonRequest(URL, { body: verifyBody() }));

    expect(response.status).toBe(200);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(await orderStore.getAllOrders()).toHaveLength(1);
  });

  it("still reports success when the email provider fails", async () => {
    sendEmail.mockResolvedValue(false);
    await pendingStore.savePendingOrder(pendingOrder());

    const response = await POST(jsonRequest(URL, { body: verifyBody() }));

    expect(response.status).toBe(200);
    expect(await orderStore.getAllOrders()).toHaveLength(1);
  });

  it("a stock-decrement failure doesn't stop the order being recorded or the customer being emailed", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await pendingStore.savePendingOrder(pendingOrder());
    // Make the products table unusable so decrementStock throws.
    const { getDb } = await import("@/lib/db");
    await (await getDb()).exec("DROP TABLE products CASCADE");

    const response = await POST(jsonRequest(URL, { body: verifyBody() }));

    expect(response.status).toBe(200);
    expect(await orderStore.getAllOrders()).toHaveLength(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Stock decrement failed"),
      expect.anything()
    );
  });
});

describe("POST /api/checkout/verify-payment — a genuine payment with no snapshot", () => {
  beforeEach(() => setup());

  it("confirms the payment but invents no order, and flags it for reconciliation", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(
      jsonRequest(URL, {
        body: {
          ...verifyBody(),
          // A browser-supplied cart must NOT be used to fabricate an order.
          items: [{ productId: 1, quantity: 1 }],
          address,
          email: "jane@example.com",
        },
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ verified: true, orderId: "order_1" });
    expect(await orderStore.getAllOrders()).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("RECONCILE"));
    // ...and the genuine payment is durably logged for the admin to resolve.
    expect(await orderStore.listUnreconciledPayments()).toMatchObject([
      { razorpayOrderId: "order_1", resolved: false },
    ]);
  });
});

describe("POST /api/checkout/verify-payment — admin new-order alert", () => {
  it("also emails the owner when an admin notification address is configured", async () => {
    await setup({ adminEmail: "owner@example.com" });
    await pendingStore.savePendingOrder(pendingOrder());

    await POST(jsonRequest(URL, { body: verifyBody() }));

    const recipients = sendEmail.mock.calls.map(([arg]) => arg.to);
    expect(recipients).toContain("jane@example.com");
    expect(recipients).toContain("owner@example.com");
  });

  it("does not email the owner when no admin address is configured", async () => {
    await setup();
    await pendingStore.savePendingOrder(pendingOrder());

    await POST(jsonRequest(URL, { body: verifyBody() }));

    expect(sendEmail.mock.calls.map(([arg]) => arg.to)).toEqual(["jane@example.com"]);
  });
});
