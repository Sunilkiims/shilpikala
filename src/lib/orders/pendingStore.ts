import type { Address } from "@/types/catalog";
import type { PricedLineItem } from "@/lib/checkout/pricing";
import { getDb } from "@/lib/db";

/**
 * A snapshot of exactly what was priced and charged when a Razorpay
 * order was created. verify-payment trusts THIS — never the cart the
 * browser claims at verification time — so:
 *   - a payment can't be "re-pointed" at a more expensive cart,
 *   - later price/stock/catalogue edits can't change what the customer
 *     is recorded as having bought, and
 *   - a valid payment can always be recorded, even if the product has
 *     since sold out or been deleted.
 *
 * Unpaid snapshots (abandoned checkouts) are pruned on each write.
 */

/** Abandoned-checkout snapshots older than this are dropped. */
export const PENDING_ORDER_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type PendingOrder = {
  razorpayOrderId: string;
  items: PricedLineItem[];
  itemsSubtotal: number;
  shipping: number;
  /** itemsSubtotal + shipping, in rupees — what the customer is charged. */
  amount: number;
  amountInPaise: number;
  customerEmail: string;
  /** Signed-in buyer, if any (resolved server-side from the session). */
  customerId?: number;
  address: Address;
  createdAt: string;
};

export async function savePendingOrder(order: PendingOrder): Promise<void> {
  const db = await getDb();
  const cutoff = new Date(Date.now() - PENDING_ORDER_TTL_MS).toISOString();
  await db.transaction(async (tx) => {
    await tx.query("DELETE FROM pending_orders WHERE created_at < $1", [cutoff]);
    await tx.query(
      `INSERT INTO pending_orders (razorpay_order_id, data, created_at)
       VALUES ($1,$2::jsonb,$3)
       ON CONFLICT (razorpay_order_id) DO UPDATE SET data = EXCLUDED.data, created_at = EXCLUDED.created_at`,
      [order.razorpayOrderId, JSON.stringify(order), order.createdAt]
    );
  });
}

export async function getPendingOrder(
  razorpayOrderId: string
): Promise<PendingOrder | undefined> {
  const db = await getDb();
  const res = await db.query<{ data: PendingOrder }>(
    "SELECT data FROM pending_orders WHERE razorpay_order_id = $1",
    [razorpayOrderId]
  );
  return res.rows[0]?.data;
}

/** Best-effort cleanup once an order has been recorded. */
export async function deletePendingOrder(razorpayOrderId: string): Promise<void> {
  const db = await getDb();
  await db.query("DELETE FROM pending_orders WHERE razorpay_order_id = $1", [razorpayOrderId]);
}
