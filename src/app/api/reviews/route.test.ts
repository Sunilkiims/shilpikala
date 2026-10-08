import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isolateStorageDir } from "@/test-support/tempStorageDir";
import { jsonRequest, malformedJsonRequest } from "@/test-support/request";
import type { StoredOrder } from "@/lib/orders/types";

const URL = "http://localhost/api/reviews";

let cleanup: () => void;
let POST: (request: Request) => Promise<Response>;
let reviewStore: typeof import("@/lib/reviews/store");

const order: StoredOrder = {
  id: "order-uuid-1",
  razorpayOrderId: "order_rzp_1",
  razorpayPaymentId: "pay_rzp_1",
  itemsSubtotal: 4500,
  shipping: 150,
  amount: 4650,
  currency: "INR",
  customerEmail: "jane@example.com",
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

const validReview = {
  orderId: "order-uuid-1",
  email: "jane@example.com",
  productId: 1,
  rating: 5,
  content: "Beautiful piece, exactly as pictured.",
  authorName: "Jane",
};

beforeEach(async () => {
  cleanup = isolateStorageDir();
  const { appendOrder } = await import("@/lib/orders/store");
  await appendOrder(order);
  reviewStore = await import("@/lib/reviews/store");
  ({ POST } = await import("@/app/api/reviews/route"));
});

afterEach(() => cleanup());

describe("POST /api/reviews", () => {
  it("accepts a verified purchase and stores it as pending", async () => {
    const response = await POST(jsonRequest(URL, { body: validReview, ip: "10.1.0.1" }));
    expect(response.status).toBe(201);

    const stored = await reviewStore.getAllReviews();
    expect(stored).toHaveLength(1);
    expect(stored[0].status).toBe("pending");
    expect(stored[0].productId).toBe(1);
    expect(stored[0].rating).toBe(5);
  });

  it("keeps a pending review out of the public (approved) listing", async () => {
    await POST(jsonRequest(URL, { body: validReview, ip: "10.1.0.2" }));
    expect(await reviewStore.getReviewsByProductId(1, "approved")).toHaveLength(0);
  });

  it("rejects an email that doesn't match the order with a generic 403", async () => {
    const response = await POST(
      jsonRequest(URL, { body: { ...validReview, email: "wrong@example.com" }, ip: "10.1.0.3" })
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "verification_failed" });
  });

  it("rejects a product that wasn't in the order with the identical generic 403", async () => {
    const wrongEmail = await POST(
      jsonRequest(URL, { body: { ...validReview, email: "wrong@example.com" }, ip: "10.1.0.4" })
    );
    const wrongProduct = await POST(
      jsonRequest(URL, { body: { ...validReview, productId: 99 }, ip: "10.1.0.5" })
    );

    expect(wrongProduct.status).toBe(403);
    expect(await wrongProduct.json()).toEqual(await wrongEmail.json());
  });

  it("rejects an unknown order with the same generic 403", async () => {
    const response = await POST(
      jsonRequest(URL, { body: { ...validReview, orderId: "does-not-exist" }, ip: "10.1.0.6" })
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "verification_failed" });
  });

  it("blocks a second review for the same order + product with 409", async () => {
    await POST(jsonRequest(URL, { body: validReview, ip: "10.1.0.7" }));
    const second = await POST(jsonRequest(URL, { body: validReview, ip: "10.1.0.7" }));

    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({ error: "already_reviewed" });
    expect(await reviewStore.getAllReviews()).toHaveLength(1);
  });

  it("returns 400 with a specific code for invalid fields", async () => {
    const response = await POST(
      jsonRequest(URL, { body: { ...validReview, rating: 9 }, ip: "10.1.0.8" })
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_rating" });
  });

  it("returns 400 for malformed JSON", async () => {
    const response = await POST(malformedJsonRequest(URL, "10.1.0.9"));
    expect(response.status).toBe(400);
  });

  it("does not store anything when verification fails", async () => {
    await POST(
      jsonRequest(URL, { body: { ...validReview, email: "wrong@example.com" }, ip: "10.1.0.10" })
    );
    expect(await reviewStore.getAllReviews()).toHaveLength(0);
  });

  it("rate-limits after 10 attempts from one IP", async () => {
    const bogus = { ...validReview, orderId: "nope" };
    for (let i = 0; i < 10; i += 1) {
      const response = await POST(jsonRequest(URL, { body: bogus, ip: "10.1.0.11" }));
      expect(response.status).toBe(403);
    }

    const limited = await POST(jsonRequest(URL, { body: bogus, ip: "10.1.0.11" }));
    expect(limited.status).toBe(429);
  });
});
