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
