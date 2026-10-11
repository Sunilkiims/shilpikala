import { createHmac } from "node:crypto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isolateStorageDir } from "@/test-support/tempStorageDir";
import { jsonRequest } from "@/test-support/request";

const { createRazorpayOrder, sendEmail } = vi.hoisted(() => ({
  createRazorpayOrder: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/razorpay/client", () => ({
  getRazorpayClient: () => ({ orders: { create: createRazorpayOrder } }),
}));
vi.mock("@/lib/email/send", () => ({ sendEmail }));

const SECRET = "flow_test_secret";
const address = {
  fullName: "Jane Doe",
  line1: "1 Test St",
  city: "Bengaluru",
  state: "KA",
  postalCode: "560001",
  country: "India",
};

let cleanup: () => void;
let createOrder: (request: Request) => Promise<Response>;
let verifyPayment: (request: Request) => Promise<Response>;
let catalog: typeof import("@/lib/store/catalogStore");
let orderStore: typeof import("@/lib/orders/store");

let nextOrderNumber = 0;

function product(overrides: Record<string, unknown> = {}) {
  return {
    name: "Flow Product",
    description: "For checkout-flow tests.",
    price: "1000.00",
    regularPrice: "1000.00",
    onSale: false,
    inStock: true,
    categorySlugs: [],
    ...overrides,
  };
}

/** Step 1: the browser asks to start a payment. Returns what Razorpay was told to charge. */
async function startCheckout(items: { productId: number; quantity: number }[], ip = "10.9.0.1") {
  const response = await createOrder(
    jsonRequest("http://localhost/api/checkout/create-order", {
      body: { items, address, email: "jane@example.com" },
      ip,
    })
  );
  expect(response.status).toBe(200);
  const { orderId } = await response.json();
  const chargedPaise = createRazorpayOrder.mock.calls.at(-1)![0].amount as number;
  return { orderId: orderId as string, chargedPaise };
}

/** Step 2: Razorpay takes the payment and hands the browser a signature; the browser calls verify. */
async function completePayment(orderId: string, extraBody: Record<string, unknown> = {}) {
  const paymentId = `pay_${orderId}`;
  const signature = createHmac("sha256", SECRET).update(`${orderId}|${paymentId}`).digest("hex");
  return verifyPayment(
    jsonRequest("http://localhost/api/checkout/verify-payment", {
      body: {
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: signature,
        ...extraBody,
      },
    })
  );
}

beforeEach(async () => {
  cleanup = isolateStorageDir();
  vi.stubEnv("RAZORPAY_KEY_SECRET", SECRET);
  vi.stubEnv("NEXT_PUBLIC_RAZORPAY_KEY_ID", "rzp_test_key");
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("EMAIL_FROM", "");
  vi.stubEnv("ADMIN_NOTIFICATION_EMAIL", "");

  nextOrderNumber = 0;
  createRazorpayOrder.mockReset();
  createRazorpayOrder.mockImplementation(async (args: { amount: number; currency: string }) => ({
    id: `order_flow_${(nextOrderNumber += 1)}`,
    amount: args.amount,
    currency: args.currency,
  }));
  sendEmail.mockReset();
  sendEmail.mockResolvedValue(true);

  catalog = await import("@/lib/store/catalogStore");
  orderStore = await import("@/lib/orders/store");
  ({ POST: createOrder } = await import("@/app/api/checkout/create-order/route"));
  ({ POST: verifyPayment } = await import("@/app/api/checkout/verify-payment/route"));
});

afterEach(() => {
  vi.unstubAllEnvs();
  cleanup();
});

describe("checkout flow: create-order → pay → verify-payment", () => {
  it("records an order whose amount equals exactly what Razorpay was asked to charge", async () => {
    const p = await catalog.createProduct(product({ price: "1234.00" }));

    const { orderId, chargedPaise } = await startCheckout([{ productId: p.id, quantity: 3 }]);
    const response = await completePayment(orderId);

    expect(response.status).toBe(200);
    const [stored] = await orderStore.getAllOrders();
    expect(Math.round(stored.amount * 100)).toBe(chargedPaise);
    expect(stored.items[0]).toMatchObject({ productId: p.id, quantity: 3 });
  });

  it("holds the invariant when the browser lies at verify time (cheap cart paid, expensive cart claimed)", async () => {
    const cheap = await catalog.createProduct(product({ name: "Cheap", price: "100.00", regularPrice: "100.00" }));
    const pricey = await catalog.createProduct(
      product({ name: "Pricey", price: "50000.00", regularPrice: "50000.00" })
    );

    const { orderId, chargedPaise } = await startCheckout([{ productId: cheap.id, quantity: 1 }]);
    await completePayment(orderId, {
      items: [{ productId: pricey.id, quantity: 1 }],
      amount: 5000000,
    });

    const [stored] = await orderStore.getAllOrders();
    expect(stored.items.map((i) => i.name)).toEqual(["Cheap"]);
    expect(Math.round(stored.amount * 100)).toBe(chargedPaise);
    expect(stored.amount).toBeLessThan(1000);
  });

  it("holds the invariant when the price is edited between checkout and payment", async () => {
    const p = await catalog.createProduct(product({ price: "1000.00" }));
    const { orderId, chargedPaise } = await startCheckout([{ productId: p.id, quantity: 1 }]);

    await catalog.updateProduct(p.id, {
      name: p.name,
      description: p.description,
      price: "7777.00",
      regularPrice: "7777.00",
      onSale: false,
      inStock: true,
      categorySlugs: [],
    });
    await completePayment(orderId);

    const [stored] = await orderStore.getAllOrders();
    expect(stored.items[0].price).toBe("1000.00");
    expect(Math.round(stored.amount * 100)).toBe(chargedPaise);
  });

  it("records the order even if the item sells out between checkout and payment", async () => {
    const p = await catalog.createProduct(product({ stockQuantity: 1 }));

    // Two customers start checkout for the last unit; both pass the stock check.
    const first = await startCheckout([{ productId: p.id, quantity: 1 }], "10.9.0.2");
    const second = await startCheckout([{ productId: p.id, quantity: 1 }], "10.9.0.3");

    await completePayment(first.orderId);
    await completePayment(second.orderId);

    // Both genuinely paid, so both are recorded — nobody pays and gets nothing.
    expect(await orderStore.getAllOrders()).toHaveLength(2);
    const current = (await catalog.getProducts()).find((x) => x.id === p.id)!;
    expect(current).toMatchObject({ stockQuantity: 0, inStock: false });
  });

  it("records the order even if the product is deleted between checkout and payment", async () => {
    const p = await catalog.createProduct(product());
    const { orderId } = await startCheckout([{ productId: p.id, quantity: 1 }]);
    await catalog.deleteProduct(p.id);

    await completePayment(orderId);

    expect(await orderStore.getAllOrders()).toHaveLength(1);
  });

  it("keeps two simultaneous checkouts completely separate", async () => {
    const a = await catalog.createProduct(product({ name: "A", price: "500.00", regularPrice: "500.00" }));
    const b = await catalog.createProduct(product({ name: "B", price: "800.00", regularPrice: "800.00" }));

    const first = await startCheckout([{ productId: a.id, quantity: 1 }], "10.9.0.4");
    const second = await startCheckout([{ productId: b.id, quantity: 2 }], "10.9.0.5");

    // Pay out of order.
    await completePayment(second.orderId);
    await completePayment(first.orderId);

    const orders = await orderStore.getAllOrders();
    const byRazorpayId = Object.fromEntries(orders.map((o) => [o.razorpayOrderId, o]));
    expect(byRazorpayId[first.orderId].items[0].name).toBe("A");
    expect(byRazorpayId[second.orderId].items[0].name).toBe("B");
    expect(Math.round(byRazorpayId[first.orderId].amount * 100)).toBe(first.chargedPaise);
    expect(Math.round(byRazorpayId[second.orderId].amount * 100)).toBe(second.chargedPaise);
  });

  it("a payment replayed after completion records nothing new", async () => {
    const p = await catalog.createProduct(product({ stockQuantity: 5 }));
    const { orderId } = await startCheckout([{ productId: p.id, quantity: 2 }]);

    await completePayment(orderId);
    await completePayment(orderId);
    await completePayment(orderId);

    expect(await orderStore.getAllOrders()).toHaveLength(1);
    expect((await catalog.getProducts()).find((x) => x.id === p.id)?.stockQuantity).toBe(3);
    expect(sendEmail).toHaveBeenCalledTimes(2); // confirmation + invoice, once
  });

  it("an order id the server never created can't be turned into an order", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await completePayment("order_never_created", {
      items: [{ productId: 1, quantity: 1 }],
      address,
      email: "attacker@example.com",
    });

    expect(response.status).toBe(200);
    expect(await orderStore.getAllOrders()).toHaveLength(0);
    errorSpy.mockRestore();
  });
});
