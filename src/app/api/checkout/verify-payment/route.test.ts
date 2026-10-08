import { createHmac } from "node:crypto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isolateStorageDir } from "@/test-support/tempStorageDir";
import { jsonRequest, malformedJsonRequest } from "@/test-support/request";

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

function sign(orderId: string, paymentId: string, secret = SECRET) {
  return createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
}

function product(overrides: Record<string, unknown> = {}) {
  return {
    name: "Verify Test Product",
    description: "For verify-payment tests.",
    price: "1000.00",
    regularPrice: "1000.00",
    onSale: false,
    inStock: true,
    categorySlugs: [],
    ...overrides,
  };
}

function verifyBody(opts: {
  orderId?: string;
  paymentId?: string;
  signature?: string;
  items?: { productId: number; quantity: number }[];
  email?: string;
}) {
  const orderId = opts.orderId ?? "order_1";
  const paymentId = opts.paymentId ?? "pay_1";
  return {
    razorpayOrderId: orderId,
    razorpayPaymentId: paymentId,
    razorpaySignature: opts.signature ?? sign(orderId, paymentId),
    items: opts.items,
    address,
    email: opts.email ?? "jane@example.com",
  };
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
  ({ POST } = await import("@/app/api/checkout/verify-payment/route"));
}

beforeEach(() => {
  sendEmail.mockReset();
  sendEmail.mockResolvedValue(true);
});

afterEach(() => {
  vi.unstubAllEnvs();
  cleanup();
});

describe("POST /api/checkout/verify-payment — gatekeeping", () => {
  it("returns 503 when Razorpay isn't configured", async () => {
    await setup({ configured: false });
    const response = await POST(jsonRequest(URL, { body: verifyBody({}) }));
    expect(response.status).toBe(503);
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

  it("rejects a bad signature, and stores / decrements / emails nothing", async () => {
    await setup();
    const p = await catalog.createProduct(product({ stockQuantity: 5 }));

    const response = await POST(
      jsonRequest(URL, {
        body: verifyBody({
          signature: sign("order_1", "pay_1", "attacker_secret"),
          items: [{ productId: p.id, quantity: 1 }],
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ verified: false });
    expect(await orderStore.getAllOrders()).toHaveLength(0);
    expect((await catalog.getProducts()).find((x) => x.id === p.id)?.stockQuantity).toBe(5);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("rejects a valid signature replayed against a different order id", async () => {
    await setup();
    const response = await POST(
      jsonRequest(URL, {
        body: verifyBody({
          orderId: "order_OTHER",
          paymentId: "pay_1",
          signature: sign("order_1", "pay_1"),
        }),
      })
    );
    expect(response.status).toBe(400);
  });
});

describe("POST /api/checkout/verify-payment — a genuine payment", () => {
  beforeEach(async () => {
    await setup();
  });

  it("verifies and persists the order with server-computed totals", async () => {
    const p = await catalog.createProduct(product({ price: "1000.00" }));

    const response = await POST(
      jsonRequest(URL, { body: verifyBody({ items: [{ productId: p.id, quantity: 2 }] }) })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ verified: true, orderId: "order_1" });

    const [stored] = await orderStore.getAllOrders();
    expect(stored.itemsSubtotal).toBe(2000);
    expect(stored.shipping).toBe(150);
    expect(stored.amount).toBe(2150);
    expect(stored.status).toBe("paid");
    expect(stored.customerEmail).toBe("jane@example.com");
    expect(stored.razorpayPaymentId).toBe("pay_1");
    expect(stored.items[0]).toMatchObject({ productId: p.id, quantity: 2, price: "1000.00" });
  });

  it("decrements tracked stock, flipping inStock off at zero", async () => {
    const p = await catalog.createProduct(product({ stockQuantity: 3 }));

    await POST(
      jsonRequest(URL, {
        body: verifyBody({ orderId: "order_a", items: [{ productId: p.id, quantity: 2 }] }),
      })
    );
    let current = (await catalog.getProducts()).find((x) => x.id === p.id)!;
    expect(current.stockQuantity).toBe(1);
    expect(current.inStock).toBe(true);

    await POST(
      jsonRequest(URL, {
        body: verifyBody({
          orderId: "order_b",
          paymentId: "pay_b",
          items: [{ productId: p.id, quantity: 1 }],
        }),
      })
    );
    current = (await catalog.getProducts()).find((x) => x.id === p.id)!;
    expect(current.stockQuantity).toBe(0);
    expect(current.inStock).toBe(false);
  });

  it("leaves untracked products' stock fields alone", async () => {
    const p = await catalog.createProduct(product());

    await POST(
      jsonRequest(URL, { body: verifyBody({ items: [{ productId: p.id, quantity: 1 }] }) })
    );

    const current = (await catalog.getProducts()).find((x) => x.id === p.id)!;
    expect(current.stockQuantity).toBeUndefined();
    expect(current.inStock).toBe(true);
  });

  it("is idempotent: replaying the same payment stores one order and decrements once", async () => {
    const p = await catalog.createProduct(product({ stockQuantity: 5 }));
    const body = verifyBody({ items: [{ productId: p.id, quantity: 2 }] });

    const first = await POST(jsonRequest(URL, { body }));
    const second = await POST(jsonRequest(URL, { body }));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await orderStore.getAllOrders()).toHaveLength(1);
    expect((await catalog.getProducts()).find((x) => x.id === p.id)?.stockQuantity).toBe(3);
  });

  it("sends the customer a confirmation, once, even if the payment is replayed", async () => {
    const p = await catalog.createProduct(product());
    const body = verifyBody({ items: [{ productId: p.id, quantity: 1 }] });

    await POST(jsonRequest(URL, { body }));
    await POST(jsonRequest(URL, { body }));

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "jane@example.com",
        subject: expect.stringContaining("confirmed"),
      })
    );
  });

  it("skips the customer email when the address is invalid, but still stores the order", async () => {
    const p = await catalog.createProduct(product());

    const response = await POST(
      jsonRequest(URL, {
        body: verifyBody({ email: "not-an-email", items: [{ productId: p.id, quantity: 1 }] }),
      })
    );

    expect(response.status).toBe(200);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(await orderStore.getAllOrders()).toHaveLength(1);
  });

  it("still reports success when the email provider fails", async () => {
    sendEmail.mockResolvedValue(false);
    const p = await catalog.createProduct(product());

    const response = await POST(
      jsonRequest(URL, { body: verifyBody({ items: [{ productId: p.id, quantity: 1 }] }) })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ verified: true, orderId: "order_1" });
    expect(await orderStore.getAllOrders()).toHaveLength(1);
  });

  it("verifies but records nothing when no items/address accompany the payment", async () => {
    const response = await POST(jsonRequest(URL, { body: verifyBody({}) }));

    expect(response.status).toBe(200);
    expect(await orderStore.getAllOrders()).toHaveLength(0);
  });

  // Characterization of a known limitation (see the Day 12 report): the
  // payment signature is already proven valid, so the endpoint reports
  // success even if the order can no longer be priced at verify time
  // (e.g. the item sold out in between). The order is NOT recorded.
  it("[known limitation] reports success but records no order if the item can't be priced at verify time", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const p = await catalog.createProduct(product({ stockQuantity: 1 }));

    const response = await POST(
      jsonRequest(URL, { body: verifyBody({ items: [{ productId: p.id, quantity: 5 }] }) })
    );

    expect(response.status).toBe(200);
    expect(await orderStore.getAllOrders()).toHaveLength(0);
    errorSpy.mockRestore();
  });
});

describe("POST /api/checkout/verify-payment — admin new-order alert", () => {
  it("also emails the owner when an admin notification address is configured", async () => {
    await setup({ adminEmail: "owner@example.com" });
    const p = await catalog.createProduct(product());

    await POST(
      jsonRequest(URL, { body: verifyBody({ items: [{ productId: p.id, quantity: 1 }] }) })
    );

    const recipients = sendEmail.mock.calls.map(([arg]) => arg.to);
    expect(recipients).toContain("jane@example.com");
    expect(recipients).toContain("owner@example.com");
  });

  it("does not email the owner when no admin address is configured", async () => {
    await setup();
    const p = await catalog.createProduct(product());

    await POST(
      jsonRequest(URL, { body: verifyBody({ items: [{ productId: p.id, quantity: 1 }] }) })
    );

    const recipients = sendEmail.mock.calls.map(([arg]) => arg.to);
    expect(recipients).toEqual(["jane@example.com"]);
  });
});
