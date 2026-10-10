import { randomUUID } from "node:crypto";
import {
  appendOrder,
  getOrderByRazorpayOrderId,
  recordUnreconciledPayment,
} from "@/lib/orders/store";
import { deletePendingOrder, getPendingOrder } from "@/lib/orders/pendingStore";
import { decrementStock } from "@/lib/store/catalogStore";
import { fetchPaymentMethod } from "@/lib/razorpay/payment";
import { sendOrderEmails } from "@/lib/orders/orderEmails";
import type { NewOrder, StoredOrder } from "@/lib/orders/types";

export type FinalizeResult =
  | { status: "created"; order: StoredOrder }
  | { status: "exists"; order: StoredOrder }
  | { status: "unreconciled" };

/**
 * The single place a VERIFIED Razorpay payment becomes an order.
 * Callers (the browser verify route and the Razorpay webhook) must have
 * checked a signature first — nothing here trusts client data.
 *
 * Idempotent: the same payment arriving twice (webhook retry, refresh,
 * double click, verify racing the webhook) records one order, decrements
 * stock once and sends each email once. The order is committed before any
 * email is attempted, and email problems never surface as errors, so they
 * can never turn a paid order into a failed one.
 */
export async function finalizeVerifiedPayment(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  /** Known from the webhook payload; otherwise looked up best-effort. */
  paymentMethod?: string;
}): Promise<FinalizeResult> {
  const { razorpayOrderId, razorpayPaymentId } = input;

  const existing = await getOrderByRazorpayOrderId(razorpayOrderId);
  if (existing) {
    // Re-attempt any email that never went out; already-sent ones are skipped.
    await sendOrderEmails(existing);
    return { status: "exists", order: existing };
  }

  const pending = await getPendingOrder(razorpayOrderId);
  if (!pending) {
    // A genuine payment we have no snapshot for. Don't invent an order
    // from client data — flag it for manual reconciliation.
    console.error(
      `[orders] RECONCILE: payment ${razorpayPaymentId} for Razorpay order ` +
        `${razorpayOrderId} verified, but no order snapshot exists.`
    );
    await recordUnreconciledPayment(
      razorpayOrderId,
      razorpayPaymentId,
      "verified payment with no order snapshot"
    ).catch((error) => console.error("[orders] Could not log unreconciled payment:", error));
    return { status: "unreconciled" };
  }

  const paymentMethod = input.paymentMethod ?? (await fetchPaymentMethod(razorpayPaymentId));

  const draft: NewOrder = {
    id: randomUUID(),
    razorpayOrderId,
    razorpayPaymentId,
    itemsSubtotal: pending.itemsSubtotal,
    shipping: pending.shipping,
    amount: pending.amount,
    currency: "INR",
    customerEmail: pending.customerEmail,
    ...(pending.customerId !== undefined ? { customerId: pending.customerId } : {}),
    address: pending.address,
    items: pending.items,
    status: "paid",
    ...(paymentMethod ? { paymentMethod } : {}),
    createdAt: new Date().toISOString(),
  };

  // The one critical step. If this throws, the caller decides what to do.
  const inserted = await appendOrder(draft);
  if (!inserted) {
    // A concurrent request recorded it first; it owns stock + cleanup.
    const winner = await getOrderByRazorpayOrderId(razorpayOrderId);
    if (!winner) throw new Error(`Order ${razorpayOrderId} vanished after a concurrent insert`);
    await sendOrderEmails(winner);
    return { status: "exists", order: winner };
  }

  const order = await getOrderByRazorpayOrderId(razorpayOrderId);
  if (!order) throw new Error(`Order ${razorpayOrderId} was inserted but could not be read back`);

  // Best-effort and independent: the order is safely recorded.
  try {
    await decrementStock(pending.items.map(({ productId, quantity }) => ({ productId, quantity })));
  } catch (error) {
    console.error(`[orders] Stock decrement failed for ${razorpayOrderId}:`, error);
  }
  try {
    await deletePendingOrder(razorpayOrderId);
  } catch (error) {
    console.error(`[orders] Snapshot cleanup failed for ${razorpayOrderId}:`, error);
  }

  await sendOrderEmails(order);
  return { status: "created", order };
}
