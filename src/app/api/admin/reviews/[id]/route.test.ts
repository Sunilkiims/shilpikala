import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isolateStorageDir } from "@/test-support/tempStorageDir";
import { jsonRequest, malformedJsonRequest, routeParams } from "@/test-support/request";
import type { StoredReview } from "@/lib/reviews/types";

let cleanup: () => void;
let PATCH: (request: Request, ctx: ReturnType<typeof routeParams>) => Promise<Response>;
let reviewStore: typeof import("@/lib/reviews/store");

const pending: StoredReview = {
  id: "review-1",
  productId: 1,
  orderId: "order-1",
  customerEmail: "jane@example.com",
  authorName: "Jane",
  rating: 4,
  content: "Lovely work.",
  status: "pending",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const URL = "http://localhost/api/admin/reviews/review-1";

beforeEach(async () => {
  cleanup = isolateStorageDir();
  reviewStore = await import("@/lib/reviews/store");
  await reviewStore.appendReview(pending);
  ({ PATCH } = await import("@/app/api/admin/reviews/[id]/route"));
});

afterEach(() => cleanup());

describe("PATCH /api/admin/reviews/[id]", () => {
  it("approves a pending review, making it publicly visible", async () => {
    const response = await PATCH(
      jsonRequest(URL, { method: "PATCH", body: { status: "approved" } }),
      routeParams({ id: "review-1" })
    );
    expect(response.status).toBe(200);

    const visible = await reviewStore.getReviewsByProductId(1, "approved");
    expect(visible).toHaveLength(1);
    expect(visible[0].id).toBe("review-1");
  });

  it("rejects a review, keeping it out of the public listing", async () => {
    await PATCH(
      jsonRequest(URL, { method: "PATCH", body: { status: "rejected" } }),
      routeParams({ id: "review-1" })
    );

    expect(await reviewStore.getReviewsByProductId(1, "approved")).toHaveLength(0);
    const all = await reviewStore.getAllReviews();
    expect(all[0].status).toBe("rejected");
  });

  it("can reverse an earlier decision", async () => {
    await PATCH(
      jsonRequest(URL, { method: "PATCH", body: { status: "approved" } }),
      routeParams({ id: "review-1" })
    );
    await PATCH(
      jsonRequest(URL, { method: "PATCH", body: { status: "rejected" } }),
      routeParams({ id: "review-1" })
    );

    expect(await reviewStore.getReviewsByProductId(1, "approved")).toHaveLength(0);
  });

  it("refuses to set a status other than approved/rejected (e.g. back to pending)", async () => {
    const response = await PATCH(
      jsonRequest(URL, { method: "PATCH", body: { status: "pending" } }),
      routeParams({ id: "review-1" })
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_status" });
  });

  it("returns 404 for an unknown review id", async () => {
    const response = await PATCH(
      jsonRequest(URL, { method: "PATCH", body: { status: "approved" } }),
      routeParams({ id: "does-not-exist" })
    );
    expect(response.status).toBe(404);
  });

  it("returns 400 for malformed JSON", async () => {
    const response = await PATCH(malformedJsonRequest(URL), routeParams({ id: "review-1" }));
    expect(response.status).toBe(400);
  });
});
