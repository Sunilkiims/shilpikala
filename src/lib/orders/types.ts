import type { Address } from "@/types/catalog";
import type { PricedLineItem } from "@/lib/checkout/pricing";

/** Fulfilment lifecycle. Every stored order starts as "paid". */
export const ORDER_STATUSES = [
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type StoredOrder = {
  id: string;
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
  trackingNumber?: string;
  carrier?: string;
  createdAt: string;
};
