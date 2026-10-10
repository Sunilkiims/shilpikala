import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isolateStorageDir } from "@/test-support/tempStorageDir";

let cleanup: () => void;
beforeEach(() => { cleanup = isolateStorageDir(); });
afterEach(() => cleanup());

const order = (id: string, amount: number, status: "paid" | "cancelled" | "shipped", qty = 1, name = "Piece") => ({
  id, razorpayOrderId: `r_${id}`, razorpayPaymentId: `p_${id}`, itemsSubtotal: amount, shipping: 0, amount,
  currency: "INR" as const, customerEmail: "a@b.co",
  address: { fullName: "A", line1: "x", city: "y", state: "z", postalCode: "1", country: "India" },
  items: [{ productId: 1, name, price: String(amount / qty), quantity: qty }] as never,
  status, createdAt: new Date().toISOString(),
});

describe("getDashboardStats", () => {
  it("excludes cancelled orders from revenue and counts what needs fulfilling", async () => {
    const orders = await import("@/lib/orders/store");
    await orders.appendOrder(order("1", 1000, "paid"));
    await orders.appendOrder(order("2", 500, "shipped"));
    await orders.appendOrder(order("3", 9999, "cancelled"));
    const { getDashboardStats } = await import("@/lib/admin/stats");
    const s = await getDashboardStats();
    expect(s).toMatchObject({ orders: 2, revenue: 1500, toFulfil: 1, ordersLast30Days: 2, revenueLast30Days: 1500 });
  });

  it("ranks best sellers by units and ignores cancelled orders", async () => {
    const orders = await import("@/lib/orders/store");
    await orders.appendOrder(order("1", 300, "paid", 3, "Lotus"));
    await orders.appendOrder(order("2", 100, "paid", 1, "Bloom"));
    await orders.appendOrder(order("3", 900, "cancelled", 9, "Ghost"));
    const { getDashboardStats } = await import("@/lib/admin/stats");
    expect((await getDashboardStats()).topProducts).toEqual([
      { name: "Lotus", units: 3 },
      { name: "Bloom", units: 1 },
    ]);
  });

  it("lists only tracked products at or below the low-stock threshold", async () => {
    const catalog = await import("@/lib/store/catalogStore");
    const base = { description: "d", price: "1.00", regularPrice: "1.00", onSale: false, inStock: true, categorySlugs: [] };
    await catalog.createProduct({ ...base, name: "Almost gone", stockQuantity: 1 });
    await catalog.createProduct({ ...base, name: "Plenty", stockQuantity: 50 });
    await catalog.createProduct({ ...base, name: "Made to order" });
    const { getDashboardStats } = await import("@/lib/admin/stats");
    expect((await getDashboardStats()).lowStock.map((p) => p.name)).toEqual(["Almost gone"]);
  });

  it("counts open items needing attention", async () => {
    const orders = await import("@/lib/orders/store");
    const inq = await import("@/lib/inquiries/store");
    await orders.recordUnreconciledPayment("o", "p", "x");
    await inq.createInquiry({ kind: "contact", name: "n", email: "e@e.co", message: "hello there" });
    const { getDashboardStats } = await import("@/lib/admin/stats");
    expect(await getDashboardStats()).toMatchObject({ openPaymentIssues: 1, newInquiries: 1, pendingReviews: 0 });
  });
});
