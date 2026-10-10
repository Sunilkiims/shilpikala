import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isolateStorageDir } from "@/test-support/tempStorageDir";
import { getBusinessProfile, isValidGstin, type BusinessProfile } from "@/lib/invoices/business";
import { computeInvoiceTotals, formatPaise } from "@/lib/invoices/totals";
import { fiscalYearFor, formatInvoiceNumber } from "@/lib/invoices/store";
import type { NewOrder, StoredOrder } from "@/lib/orders/types";

const baseOrder: StoredOrder = {
  id: "ord-1",
  orderNumber: 1001,
  razorpayOrderId: "order_1",
  razorpayPaymentId: "pay_1",
  itemsSubtotal: 2000,
  shipping: 150,
  amount: 2150,
  currency: "INR",
  customerEmail: "jane@example.com",
  address: { fullName: "Jane Doe", line1: "1 Test St", city: "Pune", state: "Maharashtra", postalCode: "411001", country: "India" },
  items: [{ productId: 1, name: "Mandala Wall Art", slug: "mandala", quantity: 2, price: "1000.00" }],
  status: "paid",
  createdAt: "2026-10-10T08:00:00.000Z",
};

const plain: BusinessProfile = { legalName: "ShilpiKala", address: "India", email: "a@b.c", phone: "1", invoicePrefix: "SK" };
const GSTIN = "27AAPFU0939F1ZV";

describe("business profile", () => {
  it("only accepts well-formed GSTINs and never invents one", () => {
    expect(isValidGstin(GSTIN)).toBe(true);
    expect(isValidGstin("12345")).toBe(false);
    expect(isValidGstin(undefined)).toBe(false);
    const none = getBusinessProfile({} as NodeJS.ProcessEnv);
    expect(none.gstin).toBeUndefined();
    expect(none.gstRatePercent).toBeUndefined();
  });

  it("ignores a GST rate (and an invalid GSTIN) unless a valid GSTIN is configured", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const bad = getBusinessProfile({ BUSINESS_GSTIN: "nonsense", GST_RATE_PERCENT: "18" } as unknown as NodeJS.ProcessEnv);
    expect(bad.gstin).toBeUndefined();
    expect(bad.gstRatePercent).toBeUndefined();
    const rateOnly = getBusinessProfile({ GST_RATE_PERCENT: "18" } as unknown as NodeJS.ProcessEnv);
    expect(rateOnly.gstRatePercent).toBeUndefined();
    const ok = getBusinessProfile({ BUSINESS_GSTIN: GSTIN.toLowerCase(), GST_RATE_PERCENT: "18", BUSINESS_STATE: "Maharashtra" } as unknown as NodeJS.ProcessEnv);
    expect(ok).toMatchObject({ gstin: GSTIN, gstRatePercent: 18, gstinStateCode: "27", state: "Maharashtra" });
  });
});

describe("invoice totals", () => {
  it("matches the order exactly and shows no tax when GST is not configured", () => {
    const t = computeInvoiceTotals(baseOrder, plain);
    expect(t.totalPaise).toBe(215000);
    expect(t.itemsPaise + t.shippingPaise).toBe(t.totalPaise);
    expect(t.discountPaise).toBe(0);
    expect(t.tax).toBeUndefined();
    expect(t.lines[0]).toMatchObject({ quantity: 2, unitPaise: 100000, totalPaise: 200000 });
  });

  it("derives a discount when items were charged less than their list prices", () => {
    const t = computeInvoiceTotals({ ...baseOrder, itemsSubtotal: 1800, amount: 1950 }, plain);
    expect(t.discountPaise).toBe(20000);
    expect(t.totalPaise).toBe(195000);
  });

  it("splits inclusive GST into CGST+SGST within the seller's state and IGST outside it", () => {
    const biz = { ...plain, gstin: GSTIN, gstRatePercent: 18, state: "maharashtra" };
    const intra = computeInvoiceTotals(baseOrder, biz).tax!;
    expect(intra.kind).toBe("cgst_sgst");
    expect(intra.taxableValuePaise + intra.totalTaxPaise).toBe(215000);
    expect(intra.cgstPaise + intra.sgstPaise).toBe(intra.totalTaxPaise);
    expect(intra.igstPaise).toBe(0);
    expect(intra.taxableValuePaise).toBe(182203); // 2150 / 1.18

    const inter = computeInvoiceTotals({ ...baseOrder, address: { ...baseOrder.address, state: "Karnataka" } }, biz).tax!;
    expect(inter.kind).toBe("igst");
    expect(inter.igstPaise).toBe(inter.totalTaxPaise);
    expect(inter.cgstPaise + inter.sgstPaise).toBe(0);
  });

  it("formats paise with Indian grouping", () => {
    expect(formatPaise(123456789)).toBe("12,34,567.89");
    expect(formatPaise(5)).toBe("0.05");
  });
});

describe("fiscal year and numbering format", () => {
  it("uses the Indian April–March year, in IST", () => {
    expect(fiscalYearFor(new Date("2026-10-10T00:00:00Z"))).toBe("2026-27");
    expect(fiscalYearFor(new Date("2027-03-31T12:00:00Z"))).toBe("2026-27");
    // 31 Mar 20:00 UTC is 1 Apr 01:30 IST → new year
    expect(fiscalYearFor(new Date("2027-03-31T20:00:00Z"))).toBe("2027-28");
    expect(fiscalYearFor(new Date("2099-12-31T00:00:00Z"))).toBe("2099-00");
    expect(formatInvoiceNumber("SK", "2026-27", 7)).toBe("SK/2026-27/00007");
  });
});

describe("invoice store + PDF (database)", () => {
  let cleanup: () => void;
  let orders: typeof import("@/lib/orders/store");
  let invoices: typeof import("@/lib/invoices/store");

  beforeEach(async () => {
    cleanup = isolateStorageDir();
    orders = await import("@/lib/orders/store");
    invoices = await import("@/lib/invoices/store");
  });
  afterEach(() => cleanup());

  async function makeOrder(n: number): Promise<StoredOrder> {
    const { orderNumber: _n, ...rest } = baseOrder;
    void _n;
    const draft: NewOrder = { ...rest, id: `ord-${n}`, razorpayOrderId: `order_${n}`, razorpayPaymentId: `pay_${n}` };
    await orders.appendOrder(draft);
    return (await orders.getOrderById(draft.id))!;
  }

  it("assigns sequential order numbers", async () => {
    const a = await makeOrder(1);
    const b = await makeOrder(2);
    expect(b.orderNumber).toBe(a.orderNumber + 1);
    expect((await orders.getOrderByReference(`SK-${a.orderNumber}`))?.id).toBe("ord-1");
    expect((await orders.getOrderByReference("ord-2"))?.id).toBe("ord-2");
    expect(await orders.getOrderByReference("SK-99999")).toBeUndefined();
  });

  it("issues gap-free, unique invoice numbers and is idempotent per order", async () => {
    await makeOrder(1);
    await makeOrder(2);
    await makeOrder(3);
    const now = new Date("2026-10-10T08:00:00Z");
    const first = await invoices.ensureInvoice("ord-1", now);
    const again = await invoices.ensureInvoice("ord-1", new Date("2026-11-01T00:00:00Z"));
    const second = await invoices.ensureInvoice("ord-2", now);
    const third = await invoices.ensureInvoice("ord-3", now);
    expect(first.invoiceNumber).toBe("SK/2026-27/00001");
    expect(again).toEqual(first); // same number and date forever
    expect([second.invoiceNumber, third.invoiceNumber]).toEqual(["SK/2026-27/00002", "SK/2026-27/00003"]);
  });

  it("numbers concurrent requests without duplicates or gaps", async () => {
    for (let i = 1; i <= 5; i++) await makeOrder(i);
    const now = new Date("2026-10-10T08:00:00Z");
    const results = await Promise.all(
      [1, 2, 3, 4, 5, 1, 2, 3].map((i) => invoices.ensureInvoice(`ord-${i}`, now))
    );
    const unique = new Set(results.map((r) => r.invoiceNumber));
    expect(unique.size).toBe(5);
    expect([...unique].sort()).toEqual([1, 2, 3, 4, 5].map((n) => `SK/2026-27/0000${n}`));
  });

  it("restarts the sequence for a new financial year", async () => {
    await makeOrder(1);
    await makeOrder(2);
    const a = await invoices.ensureInvoice("ord-1", new Date("2027-03-30T08:00:00Z"));
    const b = await invoices.ensureInvoice("ord-2", new Date("2027-04-02T08:00:00Z"));
    expect(a.invoiceNumber).toBe("SK/2026-27/00001");
    expect(b.invoiceNumber).toBe("SK/2027-28/00001");
  });

  it("refuses to invoice an order that does not exist", async () => {
    await expect(invoices.ensureInvoice("nope")).rejects.toThrow(/unknown order/);
  });

  it("renders a real, multi-line PDF from the stored order", async () => {
    const order = await makeOrder(1);
    const invoice = await invoices.ensureInvoice(order.id);
    const { renderInvoicePdf, pdfSafe } = await import("@/lib/invoices/pdf");
    const pdf = await renderInvoicePdf(order, invoice, { ...plain, gstin: GSTIN, gstRatePercent: 18, state: "Maharashtra" });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.subarray(-6).toString()).toContain("%%EOF");
    expect(pdf.length).toBeGreaterThan(2000);
    expect(pdfSafe("Asha – “Mandala” ×2 आशा")).toBe('Asha - "Mandala" x2 ???');
  });

  it("paginates a long order without throwing", async () => {
    const items = Array.from({ length: 60 }, (_, i) => ({ productId: i + 1, name: `Item number ${i + 1} with a reasonably long descriptive name`, slug: `i${i}`, quantity: 1, price: "100.00" }));
    const order = { ...baseOrder, items, itemsSubtotal: 6000, amount: 6150 };
    const { renderInvoicePdf } = await import("@/lib/invoices/pdf");
    const pdf = await renderInvoicePdf(order, { orderId: "x", invoiceNumber: "SK/2026-27/00001", fiscalYear: "2026-27", issuedAt: new Date().toISOString() }, plain);
    expect(pdf.toString("latin1").match(/\/Type \/Page\b/g)!.length).toBeGreaterThan(1);
  });
});

describe("placeholder contact details", () => {
  it("are never printed as if they were real", () => {
    const b = getBusinessProfile({} as NodeJS.ProcessEnv);
    expect(b.phone).toBe("");
    expect(b.address).toBe("");
    const set = getBusinessProfile({ BUSINESS_PHONE: "+91 98000 11111", BUSINESS_ADDRESS: "4 Art Lane, Bhopal" } as unknown as NodeJS.ProcessEnv);
    expect(set).toMatchObject({ phone: "+91 98000 11111", address: "4 Art Lane, Bhopal" });
  });
});
