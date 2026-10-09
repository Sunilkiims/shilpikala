import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isolateStorageDir } from "@/test-support/tempStorageDir";
import type { PendingOrder } from "@/lib/orders/pendingStore";

let cleanup: () => void;
let store: typeof import("@/lib/orders/pendingStore");

function pending(overrides: Partial<PendingOrder> = {}): PendingOrder {
  return {
    razorpayOrderId: "order_1",
    items: [{ productId: 1, name: "P", slug: "p", quantity: 1, price: "100.00" }],
    itemsSubtotal: 100,
    shipping: 150,
    amount: 250,
    amountInPaise: 25000,
    customerEmail: "a@b.co",
    address: { fullName: "A", line1: "b", city: "c", state: "d", postalCode: "1", country: "India" },
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

beforeEach(async () => {
  cleanup = isolateStorageDir();
  store = await import("@/lib/orders/pendingStore");
});

afterEach(() => cleanup());

describe("pendingStore", () => {
  it("returns undefined when nothing has ever been saved", async () => {
    expect(await store.getPendingOrder("order_1")).toBeUndefined();
  });

  it("round-trips a snapshot", async () => {
    await store.savePendingOrder(pending());
    expect(await store.getPendingOrder("order_1")).toEqual(pending({ createdAt: expect.any(String) as never }));
  });

  it("keeps several snapshots and finds each by its Razorpay order id", async () => {
    await store.savePendingOrder(pending({ razorpayOrderId: "order_a", amount: 1 }));
    await store.savePendingOrder(pending({ razorpayOrderId: "order_b", amount: 2 }));

    expect((await store.getPendingOrder("order_a"))?.amount).toBe(1);
    expect((await store.getPendingOrder("order_b"))?.amount).toBe(2);
  });

  it("replaces (never duplicates) a snapshot saved twice for the same order id", async () => {
    await store.savePendingOrder(pending({ amount: 1 }));
    await store.savePendingOrder(pending({ amount: 2 }));

    expect((await store.getPendingOrder("order_1"))?.amount).toBe(2);
  });

  it("deletes a snapshot without touching the others", async () => {
    await store.savePendingOrder(pending({ razorpayOrderId: "order_a" }));
    await store.savePendingOrder(pending({ razorpayOrderId: "order_b" }));

    await store.deletePendingOrder("order_a");

    expect(await store.getPendingOrder("order_a")).toBeUndefined();
    expect(await store.getPendingOrder("order_b")).toBeDefined();
  });

  it("deleting an unknown id is a harmless no-op", async () => {
    await expect(store.deletePendingOrder("nope")).resolves.toBeUndefined();
  });

  it("prunes abandoned snapshots older than the TTL when saving a new one", async () => {
    await store.savePendingOrder(pending({ razorpayOrderId: "order_stale", createdAt: daysAgo(40) }));
    await store.savePendingOrder(pending({ razorpayOrderId: "order_recent", createdAt: daysAgo(5) }));
    await store.savePendingOrder(pending({ razorpayOrderId: "order_new" }));

    expect(await store.getPendingOrder("order_stale")).toBeUndefined();
    expect(await store.getPendingOrder("order_recent")).toBeDefined();
    expect(await store.getPendingOrder("order_new")).toBeDefined();
  });

  it("exposes a 30-day TTL", () => {
    expect(store.PENDING_ORDER_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });
});
