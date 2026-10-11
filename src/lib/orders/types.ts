import type { Address } from "@/types/catalog";
import type { PricedLineItem } from "@/lib/checkout/pricing";

/** Fulfilment lifecycle. Every stored order starts as "paid". */
export const ORDER_STATUSES = [
  "paid",
  "processing",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type StoredOrder = {
  /** Internal id (UUID). Unguessable; used as the secret-ish "order reference" for lookups. */
  id: string;
  /** Friendly sequential number (1001, 1002…), shown as SK-1001. */
  orderNumber: number;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  /** Items subtotal before shipping. */
  itemsSubtotal: number;
  shipping: number;
  /** itemsSubtotal + shipping — what was actually charged. */
  amount: number;
  currency: "INR";
  customerEmail: string;
  /** Set when the buyer was signed in at checkout. */
  customerId?: number;
  address: Address;
  items: PricedLineItem[];
  status: OrderStatus;
  /** e.g. "upi", "card" — from Razorpay, when known. */
  paymentMethod?: string;
  trackingNumber?: string;
  carrier?: string;
  /** When delivery was confirmed (set when the order is marked delivered). Starts the return window. */
  deliveredAt?: string;
  createdAt: string;
};

/** What goes in the order number slot of subjects, PDFs and the UI. */
export function formatOrderNumber(orderNumber: number): string {
  return `SK-${orderNumber}`;
}

/** Accepts "SK-1001", "sk1001" or "1001"; returns the number or null. */
export function parseOrderNumber(reference: string): number | null {
  const match = /^\s*(?:sk[-\s]?)?(\d{1,9})\s*$/i.exec(reference);
  return match ? Number(match[1]) : null;
}

/** Fields the database assigns itself. */
export type NewOrder = Omit<StoredOrder, "orderNumber">;
