import type { Address } from "@/types/catalog";
import type { PricedLineItem } from "@/lib/checkout/pricing";

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
  address: Address;
  items: PricedLineItem[];
  status: "paid";
  createdAt: string;
};
