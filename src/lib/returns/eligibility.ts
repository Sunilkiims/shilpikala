import type { StoredOrder } from "@/lib/orders/types";
import { returnWindowDays } from "@/lib/returns/config";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Tolerance for clock differences between servers. */
const CLOCK_SKEW_MS = 5 * 60 * 1000;

export type ProductPolicy = { returnable: boolean; replaceable: boolean; note?: string };
export type PolicyMap = Map<number, ProductPolicy>;
export const DEFAULT_POLICY: ProductPolicy = { returnable: true, replaceable: true };

export type WindowState = "open" | "not_delivered" | "delivery_date_missing" | "window_closed";

export type ItemEligibility = {
  productId: number;
  name: string;
  unitPricePaise: number;
  orderedQty: number;
  /** Units already covered by a live (not rejected / cancelled) request. */
  heldQty: number;
  availableQty: number;
  /** What the admin allows for this product. */
  policyReturnable: boolean;
  policyReplaceable: boolean;
  policyNote?: string;
  canReturn: boolean;
  canReplace: boolean;
};

export type OrderEligibility = {
  state: WindowState;
  deliveredAt?: string;
  deadlineAt?: string;
  /** Whole days left, rounded up; 0 once closed. */
  daysRemaining: number;
  windowDays: number;
  items: ItemEligibility[];
  /** The window is open AND at least one unit can still be returned or replaced. */
  canRequest: boolean;
};

/** Price as an integer number of paise — money is never summed as floating rupees. */
export const toPaise = (rupees: number | string): number => Math.round(Number(rupees) * 100);

/**
 * Server-side eligibility. The window runs from the CONFIRMED DELIVERY
 * timestamp (not the order date) to exactly N×24h later, inclusive.
 * A missing, unparseable or future delivery time never opens a window.
 */
export function evaluateEligibility(
  order: StoredOrder,
  policies: PolicyMap,
  heldByProduct: Map<number, number>,
  now: Date = new Date()
): OrderEligibility {
  const windowDays = returnWindowDays();
  const items: ItemEligibility[] = [];
  const orderedByProduct = new Map<number, { name: string; price: string; qty: number }>();
  for (const line of order.items) {
    const existing = orderedByProduct.get(line.productId);
    if (existing) existing.qty += line.quantity;
    else orderedByProduct.set(line.productId, { name: line.name, price: line.price, qty: line.quantity });
  }

  let state: WindowState;
  let deliveredAt: string | undefined;
  let deadlineAt: string | undefined;
  let daysRemaining = 0;

  if (order.status !== "delivered") {
    state = "not_delivered";
  } else {
    const delivered = order.deliveredAt ? new Date(order.deliveredAt) : undefined;
    if (!delivered || Number.isNaN(delivered.getTime()) || delivered.getTime() > now.getTime() + CLOCK_SKEW_MS) {
      state = "delivery_date_missing";
    } else {
      deliveredAt = delivered.toISOString();
      const deadline = new Date(delivered.getTime() + windowDays * DAY_MS);
      deadlineAt = deadline.toISOString();
      if (now.getTime() <= deadline.getTime()) {
        state = "open";
        daysRemaining = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / DAY_MS));
      } else {
        state = "window_closed";
      }
    }
  }

  for (const [productId, line] of orderedByProduct) {
    const policy = policies.get(productId) ?? DEFAULT_POLICY;
    const heldQty = heldByProduct.get(productId) ?? 0;
    const availableQty = Math.max(0, line.qty - heldQty);
    const open = state === "open" && availableQty > 0;
    items.push({
      productId,
      name: line.name,
      unitPricePaise: toPaise(line.price),
      orderedQty: line.qty,
      heldQty,
      availableQty,
      policyReturnable: policy.returnable,
      policyReplaceable: policy.replaceable,
      ...(policy.note ? { policyNote: policy.note } : {}),
      canReturn: open && policy.returnable,
      canReplace: open && policy.replaceable,
    });
  }

  return {
    state,
    ...(deliveredAt ? { deliveredAt } : {}),
    ...(deadlineAt ? { deadlineAt } : {}),
    daysRemaining,
    windowDays,
    items,
    canRequest: state === "open" && items.some((i) => i.canReturn || i.canReplace),
  };
}

/** What a request for these items would refund: item value, plus shipping when the whole order comes back for a seller-fault reason. */
export function computeRefundPaise(
  order: StoredOrder,
  items: { productId: number; quantity: number; unitPricePaise: number }[],
  sellerFault: boolean
): number {
  const itemsTotal = items.reduce((sum, i) => sum + i.unitPricePaise * i.quantity, 0);
  const orderedUnits = new Map<number, number>();
  for (const line of order.items) orderedUnits.set(line.productId, (orderedUnits.get(line.productId) ?? 0) + line.quantity);
  const requestedUnits = new Map<number, number>();
  for (const i of items) requestedUnits.set(i.productId, (requestedUnits.get(i.productId) ?? 0) + i.quantity);
  const wholeOrder =
    [...orderedUnits].every(([id, qty]) => requestedUnits.get(id) === qty) && requestedUnits.size === orderedUnits.size;
  const shipping = sellerFault && wholeOrder ? toPaise(order.shipping) : 0;
  return itemsTotal + shipping;
}
