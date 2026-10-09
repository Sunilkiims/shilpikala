import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Address } from "@/types/catalog";
import type { PricedLineItem } from "@/lib/checkout/pricing";

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
 * Same whole-file JSON-Lines pattern as the reviews store. Unpaid
 * snapshots (abandoned checkouts) are pruned on each write.
 */

const STORAGE_DIR = path.join(process.cwd(), "storage");
const PENDING_FILE = path.join(STORAGE_DIR, "pending-orders.jsonl");

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
  address: Address;
  createdAt: string;
};

async function readAll(): Promise<PendingOrder[]> {
  try {
    const raw = await readFile(PENDING_FILE, "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as PendingOrder);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeAll(orders: PendingOrder[]): Promise<void> {
  await mkdir(STORAGE_DIR, { recursive: true });
  const content = orders.map((order) => JSON.stringify(order)).join("\n");
  await writeFile(PENDING_FILE, content ? `${content}\n` : "", "utf8");
}

export async function savePendingOrder(order: PendingOrder): Promise<void> {
  const cutoff = Date.now() - PENDING_ORDER_TTL_MS;
  const existing = await readAll();

  const kept = existing.filter(
    (candidate) =>
      new Date(candidate.createdAt).getTime() >= cutoff &&
      candidate.razorpayOrderId !== order.razorpayOrderId
  );

  await writeAll([...kept, order]);
}

export async function getPendingOrder(
  razorpayOrderId: string
): Promise<PendingOrder | undefined> {
  const orders = await readAll();
  return orders.find((order) => order.razorpayOrderId === razorpayOrderId);
}

/** Best-effort cleanup once an order has been recorded. */
export async function deletePendingOrder(razorpayOrderId: string): Promise<void> {
  const orders = await readAll();
  const remaining = orders.filter((order) => order.razorpayOrderId !== razorpayOrderId);
  if (remaining.length !== orders.length) await writeAll(remaining);
}
