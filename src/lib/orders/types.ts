import type { Address } from "@/types/woocommerce";
import type { PricedLineItem } from "@/lib/checkout/pricing";

export type StoredOrder = {
  id: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  amount: number;
  currency: "INR";
  address: Address;
  items: PricedLineItem[];
  status: "paid";
  createdAt: string;
};
