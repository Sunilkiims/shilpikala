import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isolateStorageDir } from "@/test-support/tempStorageDir";
import { jsonRequest, malformedJsonRequest } from "@/test-support/request";

const { createRazorpayOrder } = vi.hoisted(() => ({ createRazorpayOrder: vi.fn() }));

vi.mock("@/lib/razorpay/client", () => ({
  getRazorpayClient: () => ({ orders: { create: createRazorpayOrder } }),
}));

const URL = "http://localhost/api/checkout/create-order";

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
let pendingStore: typeof import("@/lib/orders/pendingStore");

function baseProduct(overrides: Record<string, unknown> = {}) {
  return {
    name: "Route Test Product",
    description: "For create-order tests.",
    price: "1000.00",
    regularPrice: "1000.00",
    onSale: false,
    inStock: true,
    categorySlugs: [],
    ...overrides,
  };
}

async function setup(env: { configured: boolean }) {
  cleanup = isolateStorageDir();
  vi.stubEnv("NEXT_PUBLIC_RAZORPAY_KEY_ID", env.configured ? "rzp_test_key" : "");
  vi.stubEnv("RAZORPAY_KEY_SECRET", env.configured ? "rzp_test_secret" : "");
  catalog = await import("@/lib/store/catalogStore");
  pendingStore = await import("@/lib/orders/pendingStore");
  ({ POST } = await import("@/app/api/checkout/create-order/route"));
}

beforeEach(() => {
  createRazorpayOrder.mockReset();
  createRazorpayOrder.mockImplementation(async (args: { amount: number; currency: string }) => ({
    id: "order_mock_1",
    amount: args.amount,
    currency: args.currency,
  }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  cleanup();
});

describe("POST /api/checkout/create-order — when Razorpay isn't configured", () => {
  it("returns 503 payment_not_configured without calling Razorpay", async () => {
    await setup({ configured: false });

    const response = await POST(
      jsonRequest(URL, { body: { items: [{ productId: 1, quantity: 1 }], address, email: "a@b.co" } })
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "payment_not_configured" });
    expect(createRazorpayOrder).not.toHaveBeenCalled();
  });
});

describe("POST /api/checkout/create-order — request validation", () => {
  beforeEach(async () => {
    await setup({ configured: true });
  });

  it("rejects malformed JSON", async () => {
    expect((await POST(malformedJsonRequest(URL))).status).toBe(400);
  });

  it("rejects an empty cart", async () => {
    const response = await POST(jsonRequest(URL, { body: { items: [], address, email: "a@b.co" } }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "empty_cart" });
  });

  it("rejects an incomplete address", async () => {
    const product = await catalog.createProduct(baseProduct());
    const response = await POST(
      jsonRequest(URL, {
        body: {
          items: [{ productId: product.id, quantity: 1 }],
          address: { ...address, city: "" },
          email: "a@b.co",
        },
      })
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_address" });
  });

  it("rejects a missing or malformed email", async () => {
    const product = await catalog.createProduct(baseProduct());
    const response = await POST(
      jsonRequest(URL, {
        body: { items: [{ productId: product.id, quantity: 1 }], address, email: "not-an-email" },
      })
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_email" });
  });

  it("never calls Razorpay when validation fails", async () => {
    await POST(jsonRequest(URL, { body: { items: [], address, email: "a@b.co" } }));
    expect(createRazorpayOrder).not.toHaveBeenCalled();
  });
});

describe("POST /api/checkout/create-order — pricing and stock", () => {
  beforeEach(async () => {
    await setup({ configured: true });
  });

  it("charges the catalogue price plus flat shipping, in paise", async () => {
    const product = await catalog.createProduct(baseProduct({ price: "1000.00" }));

    const response = await POST(
      jsonRequest(URL, {
        body: { items: [{ productId: product.id, quantity: 2 }], address, email: "a@b.co" },
      })
    );

    expect(response.status).toBe(200);
    // 2 x ₹1000 = ₹2000, + ₹150 flat shipping = ₹2150 = 215000 paise
    expect(createRazorpayOrder).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 215000, currency: "INR" })
    );

    const body = await response.json();
    expect(body.orderId).toBe("order_mock_1");
    expect(body.itemsSubtotal).toBe(2000);
    expect(body.shipping).toBe(150);
    expect(body.keyId).toBe("rzp_test_key");
  });

  it("charges no shipping once the subtotal reaches the free threshold", async () => {
    const product = await catalog.createProduct(
      baseProduct({ price: "5000.00", regularPrice: "5000.00" })
    );

    const response = await POST(
      jsonRequest(URL, {
        body: { items: [{ productId: product.id, quantity: 1 }], address, email: "a@b.co" },
      })
    );

    expect(createRazorpayOrder).toHaveBeenCalledWith(expect.objectContaining({ amount: 500000 }));
    expect((await response.json()).shipping).toBe(0);
  });

  it("ignores any price the client tries to send — only product ids and quantities count", async () => {
    const product = await catalog.createProduct(baseProduct({ price: "1000.00" }));

    await POST(
      jsonRequest(URL, {
        body: {
          items: [{ productId: product.id, quantity: 1, price: "1.00", amount: 1 }],
          address,
          email: "a@b.co",
          amount: 100,
        },
      })
    );

    expect(createRazorpayOrder).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 115000 })
    );
  });

  it("rejects an unknown product before touching Razorpay", async () => {
    const response = await POST(
      jsonRequest(URL, {
        body: { items: [{ productId: 999999, quantity: 1 }], address, email: "a@b.co" },
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "unknown_product" });
    expect(createRazorpayOrder).not.toHaveBeenCalled();
  });

  it("rejects an out-of-stock product", async () => {
    const product = await catalog.createProduct(baseProduct({ inStock: false }));

    const response = await POST(
      jsonRequest(URL, {
        body: { items: [{ productId: product.id, quantity: 1 }], address, email: "a@b.co" },
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "out_of_stock" });
    expect(createRazorpayOrder).not.toHaveBeenCalled();
  });

  it("rejects a quantity beyond tracked stock", async () => {
    const product = await catalog.createProduct(baseProduct({ stockQuantity: 2 }));

    const response = await POST(
      jsonRequest(URL, {
        body: { items: [{ productId: product.id, quantity: 3 }], address, email: "a@b.co" },
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "insufficient_stock" });
  });

  it("returns 502 (not a crash) when Razorpay itself fails", async () => {
    createRazorpayOrder.mockRejectedValue(new Error("Razorpay is down"));
    const product = await catalog.createProduct(baseProduct());
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await POST(
      jsonRequest(URL, {
        body: { items: [{ productId: product.id, quantity: 1 }], address, email: "a@b.co" },
      })
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "order_creation_failed" });
    errorSpy.mockRestore();
  });
});

describe("POST /api/checkout/create-order — the order snapshot", () => {
  beforeEach(async () => {
    await setup({ configured: true });
  });

  it("saves a snapshot of exactly what was priced and charged, keyed by the Razorpay order id", async () => {
    const product = await catalog.createProduct(baseProduct({ price: "1000.00" }));

    const response = await POST(
      jsonRequest(URL, {
        body: { items: [{ productId: product.id, quantity: 2 }], address, email: "jane@example.com" },
      })
    );
    const { orderId } = await response.json();

    const snapshot = await pendingStore.getPendingOrder(orderId);
    expect(snapshot).toBeDefined();
    expect(snapshot).toMatchObject({
      razorpayOrderId: "order_mock_1",
      itemsSubtotal: 2000,
      shipping: 150,
      amount: 2150,
      amountInPaise: 215000,
      customerEmail: "jane@example.com",
    });
    expect(snapshot!.items[0]).toMatchObject({ productId: product.id, quantity: 2, price: "1000.00" });
  });

  it("the snapshot's charge always equals the amount sent to Razorpay", async () => {
    const product = await catalog.createProduct(baseProduct({ price: "1234.00" }));

    await POST(
      jsonRequest(URL, {
        body: { items: [{ productId: product.id, quantity: 3 }], address, email: "a@b.co" },
      })
    );

    const charged = createRazorpayOrder.mock.calls[0][0].amount as number;
    const snapshot = await pendingStore.getPendingOrder("order_mock_1");
    expect(snapshot!.amountInPaise).toBe(charged);
    expect(Math.round(snapshot!.amount * 100)).toBe(charged);
  });

  it("stores a cleaned address: trimmed, known fields only, no client extras", async () => {
    const product = await catalog.createProduct(baseProduct());

    await POST(
      jsonRequest(URL, {
        body: {
          items: [{ productId: product.id, quantity: 1 }],
          address: { ...address, fullName: "  Jane Doe  ", isAdmin: true, notes: "x".repeat(5000) },
          email: "a@b.co",
        },
      })
    );

    const snapshot = await pendingStore.getPendingOrder("order_mock_1");
    expect(snapshot!.address.fullName).toBe("Jane Doe");
    expect(snapshot!.address).not.toHaveProperty("isAdmin");
    expect(snapshot!.address).not.toHaveProperty("notes");
  });

  it("saves no snapshot when validation fails", async () => {
    await POST(jsonRequest(URL, { body: { items: [], address, email: "a@b.co" } }));
    await POST(
      jsonRequest(URL, {
        body: { items: [{ productId: 999999, quantity: 1 }], address, email: "a@b.co" },
      })
    );
    expect(await pendingStore.getPendingOrder("order_mock_1")).toBeUndefined();
  });

  it("saves no snapshot when Razorpay fails", async () => {
    createRazorpayOrder.mockRejectedValue(new Error("down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const product = await catalog.createProduct(baseProduct());

    await POST(
      jsonRequest(URL, {
        body: { items: [{ productId: product.id, quantity: 1 }], address, email: "a@b.co" },
      })
    );

    expect(await pendingStore.getPendingOrder("order_mock_1")).toBeUndefined();
    errorSpy.mockRestore();
  });

  it("refuses to start a payment it couldn't snapshot: 500 and no order id handed out", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const product = await catalog.createProduct(baseProduct());
    // Make the snapshot table unusable so saving the snapshot throws.
    const { getDb } = await import("@/lib/db");
    await (await getDb()).exec("DROP TABLE pending_orders");

    const response = await POST(
      jsonRequest(URL, {
        body: { items: [{ productId: product.id, quantity: 1 }], address, email: "a@b.co" },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "order_snapshot_failed" });
    expect(body).not.toHaveProperty("orderId");
    errorSpy.mockRestore();
  });

  it("rejects a cart whose entries aren't objects with 400, not a crash", async () => {
    for (const items of [[null], ["abc"], [123]]) {
      const response = await POST(jsonRequest(URL, { body: { items, address, email: "a@b.co" } }));
      expect(response.status).toBe(400);
    }
  });
});
