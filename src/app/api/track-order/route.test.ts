import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isolateStorageDir } from "@/test-support/tempStorageDir";
import { jsonRequest, malformedJsonRequest } from "@/test-support/request";
import type { StoredOrder } from "@/lib/orders/types";

const URL = "http://localhost/api/track-order";

let cleanup: () => void;
let POST: (request: Request) => Promise<Response>;

const order: StoredOrder = {
  id: "order-uuid-1",
  razorpayOrderId: "order_rzp_1",
  razorpayPaymentId: "pay_rzp_1",
  itemsSubtotal: 4500,
  shipping: 150,
  amount: 4650,
  currency: "INR",
  customerEmail: "Jane@Example.com",
  address: {
    fullName: "Jane Doe",
    line1: "1 Test St",
    city: "Bengaluru",
    state: "KA",
    postalCode: "560001",
    country: "India",
  },
  items: [
    { productId: 1, name: "Test Product", slug: "test-product", quantity: 1, price: "4500.00" },
  ],
  status: "paid",
  createdAt: "2026-01-01T00:00:00.000Z",
};

beforeEach(async () => {
  cleanup = isolateStorageDir();
  const { appendOrder } = await import("@/lib/orders/store");
  await appendOrder(order);
  ({ POST } = await import("@/app/api/track-order/route"));
});

afterEach(() => cleanup());

describe("POST /api/track-order", () => {
  it("returns the order for a matching reference + email", async () => {
    const response = await POST(
      jsonRequest(URL, { body: { orderId: "order-uuid-1", email: "Jane@Example.com" }, ip: "10.0.0.1" })
    );
    expect(response.status).toBe(200);

    const { order: returned } = await response.json();
    expect(returned.id).toBe("order-uuid-1");
    expect(returned.amount).toBe(4650);
    expect(returned.items).toHaveLength(1);
  });

  it("does not expose Razorpay identifiers or the customer email", async () => {
    const response = await POST(
      jsonRequest(URL, { body: { orderId: "order-uuid-1", email: "jane@example.com" }, ip: "10.0.0.2" })
    );
    const { order: returned } = await response.json();

    expect(returned).not.toHaveProperty("razorpayOrderId");
    expect(returned).not.toHaveProperty("razorpayPaymentId");
    expect(returned).not.toHaveProperty("customerEmail");
  });

  it("matches the email case-insensitively and ignores surrounding whitespace", async () => {
    const response = await POST(
      jsonRequest(URL, { body: { orderId: " order-uuid-1 ", email: "  JANE@example.COM " }, ip: "10.0.0.3" })
    );
    expect(response.status).toBe(200);
  });

  it("returns an identical generic 404 for a wrong email and a wrong order id", async () => {
    const wrongEmail = await POST(
      jsonRequest(URL, { body: { orderId: "order-uuid-1", email: "wrong@example.com" }, ip: "10.0.0.4" })
    );
    const wrongId = await POST(
      jsonRequest(URL, { body: { orderId: "nope", email: "jane@example.com" }, ip: "10.0.0.5" })
    );

    expect(wrongEmail.status).toBe(404);
    expect(wrongId.status).toBe(404);
    expect(await wrongEmail.json()).toEqual(await wrongId.json());
  });

  it("rejects missing fields with 400", async () => {
    const response = await POST(jsonRequest(URL, { body: { orderId: "order-uuid-1" }, ip: "10.0.0.6" }));
    expect(response.status).toBe(400);
  });

  it("rejects malformed JSON with 400", async () => {
    const response = await POST(malformedJsonRequest(URL, "10.0.0.7"));
    expect(response.status).toBe(400);
  });

  it("rate-limits after 15 attempts from one IP, with a Retry-After header", async () => {
    const body = { orderId: "nope", email: "nope@example.com" };

    for (let i = 0; i < 15; i += 1) {
      const response = await POST(jsonRequest(URL, { body, ip: "10.0.0.8" }));
      expect(response.status).toBe(404);
    }

    const limited = await POST(jsonRequest(URL, { body, ip: "10.0.0.8" }));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);
  });

  it("keeps rate-limit buckets independent per IP", async () => {
    const body = { orderId: "nope", email: "nope@example.com" };
    for (let i = 0; i < 15; i += 1) {
      await POST(jsonRequest(URL, { body, ip: "10.0.0.9" }));
    }

    const otherIp = await POST(jsonRequest(URL, { body, ip: "10.0.0.10" }));
    expect(otherIp.status).toBe(404);
  });
});
