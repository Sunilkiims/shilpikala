import type { StoredOrder } from "@/lib/orders/types";
import type { BusinessProfile } from "./business";

/** All amounts are integer paise so the invoice always adds up exactly. */
export type InvoiceLine = {
  name: string;
  quantity: number;
  unitPaise: number;
  totalPaise: number;
};

export type InvoiceTotals = {
  lines: InvoiceLine[];
  /** Sum of the line totals (list prices). */
  grossItemsPaise: number;
  /** Discount actually applied = list prices minus what was charged for items. */
  discountPaise: number;
  /** What was charged for items. */
  itemsPaise: number;
  shippingPaise: number;
  /** Final amount charged — always equals order.amount. */
  totalPaise: number;
  tax?: {
    ratePercent: number;
    /** Prices are GST-inclusive: taxable value = total − tax. */
    taxableValuePaise: number;
    kind: "igst" | "cgst_sgst";
    igstPaise: number;
    cgstPaise: number;
    sgstPaise: number;
    totalTaxPaise: number;
  };
};

export const toPaise = (rupees: number): number => Math.round(rupees * 100);

const same = (a?: string, b?: string) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Derives every invoice figure from the stored order. Nothing is
 * re-priced: the total is the amount the customer paid. GST is shown
 * only when a valid GSTIN and rate are configured, and treats the
 * charged prices as GST-inclusive (so the total never changes).
 */
export function computeInvoiceTotals(order: StoredOrder, business: BusinessProfile): InvoiceTotals {
  const lines = order.items.map((item) => {
    const unitPaise = toPaise(Number(item.price));
    return { name: item.name, quantity: item.quantity, unitPaise, totalPaise: unitPaise * item.quantity };
  });
  const grossItemsPaise = lines.reduce((sum, l) => sum + l.totalPaise, 0);
  const itemsPaise = toPaise(order.itemsSubtotal);
  const shippingPaise = toPaise(order.shipping);
  const totalPaise = toPaise(order.amount);
  const discountPaise = Math.max(0, grossItemsPaise - itemsPaise);

  const totals: InvoiceTotals = {
    lines,
    grossItemsPaise,
    discountPaise,
    itemsPaise,
    shippingPaise,
    totalPaise,
  };

  if (business.gstin && business.gstRatePercent) {
    const rate = business.gstRatePercent;
    const taxable = Math.round((totalPaise * 100) / (100 + rate));
    const totalTax = totalPaise - taxable;
    // Intra-state when the buyer's state matches the seller's.
    const intra = same(order.address.state, business.state);
    const half = Math.floor(totalTax / 2);
    totals.tax = {
      ratePercent: rate,
      taxableValuePaise: taxable,
      kind: intra ? "cgst_sgst" : "igst",
      igstPaise: intra ? 0 : totalTax,
      cgstPaise: intra ? half : 0,
      sgstPaise: intra ? totalTax - half : 0,
      totalTaxPaise: totalTax,
    };
  }
  return totals;
}

/** "1,234.50" — plain ASCII; the PDF uses the "Rs." prefix. */
export function formatPaise(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const rest = String(abs % 100).padStart(2, "0");
  return `${sign}${new Intl.NumberFormat("en-IN").format(rupees)}.${rest}`;
}

export const rupees = (paise: number) => `₹${formatPaise(paise)}`;
export const rs = (paise: number) => `Rs. ${formatPaise(paise)}`;
