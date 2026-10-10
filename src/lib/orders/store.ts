import type { Address } from "@/types/catalog";
import type { PricedLineItem } from "@/lib/checkout/pricing";
import type { OrderStatus, StoredOrder } from "@/lib/orders/types";
import { getDb } from "@/lib/db";
import { iso, isUniqueViolation, num } from "@/lib/db/rows";

type OrderRow = {
  id: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  items_subtotal: number;
  shipping: number;
  amount: number;
  currency: string;
  customer_email: string;
  customer_id: number | null;
  address: Address;
  items: PricedLineItem[];
  status: OrderStatus;
  tracking_number: string | null;
  carrier: string | null;
  created_at: Date | string;
};

function toOrder(r: OrderRow): StoredOrder {
  const order: StoredOrder = {
    id: r.id,
    razorpayOrderId: r.razorpay_order_id,
    razorpayPaymentId: r.razorpay_payment_id,
    itemsSubtotal: num(r.items_subtotal),
    shipping: num(r.shipping),
    amount: num(r.amount),
    currency: "INR",
    customerEmail: r.customer_email,
    address: r.address,
    items: r.items,
    status: r.status,
    createdAt: iso(r.created_at),
  };
  if (r.customer_id !== null && r.customer_id !== undefined) order.customerId = num(r.customer_id);
  if (r.tracking_number) order.trackingNumber = r.tracking_number;
  if (r.carrier) order.carrier = r.carrier;
  return order;
}

/**
 * Inserts an order. The razorpay_order_id UNIQUE constraint makes a
 * racing replay a no-op instead of a duplicate — returns false then.
 */
export async function appendOrder(order: StoredOrder): Promise<boolean> {
  const db = await getDb();
  try {
    await db.query(
      `INSERT INTO orders (id, razorpay_order_id, razorpay_payment_id, items_subtotal, shipping,
         amount, currency, customer_email, customer_id, address, items, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13,$13)`,
      [
        order.id, order.razorpayOrderId, order.razorpayPaymentId, order.itemsSubtotal,
        order.shipping, order.amount, order.currency, order.customerEmail,
        order.customerId ?? null, JSON.stringify(order.address), JSON.stringify(order.items),
        order.status, order.createdAt,
      ]
    );
    return true;
  } catch (error) {
    if (isUniqueViolation(error)) return false;
    throw error;
  }
}

async function one(where: string, param: unknown): Promise<StoredOrder | undefined> {
  const db = await getDb();
  const res = await db.query<OrderRow>(`SELECT * FROM orders WHERE ${where} LIMIT 1`, [param]);
  return res.rows[0] ? toOrder(res.rows[0]) : undefined;
}

export const getOrderByRazorpayOrderId = (id: string) => one("razorpay_order_id = $1", id);
export const getOrderById = (id: string) => one("id = $1", id);

export async function getAllOrders(): Promise<StoredOrder[]> {
  const db = await getDb();
  const res = await db.query<OrderRow>("SELECT * FROM orders ORDER BY created_at DESC");
  return res.rows.map(toOrder);
}

/** Orders belonging to an account: linked by id, or placed with the same verified email. */
export async function getOrdersForCustomer(
  customerId: number,
  email: string
): Promise<StoredOrder[]> {
  const db = await getDb();
  const res = await db.query<OrderRow>(
    `SELECT * FROM orders WHERE customer_id = $1 OR lower(customer_email) = lower($2)
      ORDER BY created_at DESC`,
    [customerId, email]
  );
  return res.rows.map(toOrder);
}

export async function updateOrderFulfilment(
  id: string,
  patch: { status?: OrderStatus; trackingNumber?: string | null; carrier?: string | null }
): Promise<StoredOrder | undefined> {
  const db = await getDb();
  const res = await db.query<OrderRow>(
    `UPDATE orders SET
        status = COALESCE($2, status),
        tracking_number = CASE WHEN $3::boolean THEN $4 ELSE tracking_number END,
        carrier = CASE WHEN $5::boolean THEN $6 ELSE carrier END,
        updated_at = now()
      WHERE id = $1 RETURNING *`,
    [
      id,
      patch.status ?? null,
      patch.trackingNumber !== undefined, patch.trackingNumber ?? null,
      patch.carrier !== undefined, patch.carrier ?? null,
    ]
  );
  return res.rows[0] ? toOrder(res.rows[0]) : undefined;
}

// ---- Genuine payments we could not match to a snapshot -------------

export type UnreconciledPayment = {
  id: number;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  reason: string;
  resolved: boolean;
  createdAt: string;
};

export async function recordUnreconciledPayment(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  reason: string
): Promise<void> {
  const db = await getDb();
  await db.query(
    "INSERT INTO unreconciled_payments (razorpay_order_id, razorpay_payment_id, reason) VALUES ($1,$2,$3)",
    [razorpayOrderId, razorpayPaymentId, reason]
  );
}

export async function listUnreconciledPayments(): Promise<UnreconciledPayment[]> {
  const db = await getDb();
  const res = await db.query<{
    id: number; razorpay_order_id: string; razorpay_payment_id: string;
    reason: string; resolved: boolean; created_at: Date | string;
  }>("SELECT * FROM unreconciled_payments ORDER BY resolved, created_at DESC");
  return res.rows.map((r) => ({
    id: num(r.id),
    razorpayOrderId: r.razorpay_order_id,
    razorpayPaymentId: r.razorpay_payment_id,
    reason: r.reason,
    resolved: r.resolved,
    createdAt: iso(r.created_at),
  }));
}

export async function resolveUnreconciledPayment(id: number): Promise<boolean> {
  const db = await getDb();
  const res = await db.query("UPDATE unreconciled_payments SET resolved = true WHERE id = $1", [id]);
  return res.rowCount > 0;
}
