import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isRazorpayConfigured } from "@/lib/razorpay/config";
import { verifyPaymentSignature } from "@/lib/razorpay/verify";
import { computeOrderTotals, PricingError } from "@/lib/checkout/pricing";
import { appendOrder, getOrderByRazorpayOrderId } from "@/lib/orders/store";
import { decrementStock } from "@/lib/store/catalogStore";
import type { Address } from "@/types/catalog";

type VerifyRequestBody = {
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  items?: { productId: number; quantity: number }[];
  address?: Address;
};

export async function POST(request: Request) {
  if (!isRazorpayConfigured()) {
    return NextResponse.json(
      { error: "payment_not_configured" },
      { status: 503 }
    );
  }

  let body: VerifyRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, items, address } =
    body;

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const isValid = verifyPaymentSignature({
    orderId: razorpayOrderId,
    paymentId: razorpayPaymentId,
    signature: razorpaySignature,
  });

  if (!isValid) {
    return NextResponse.json({ verified: false }, { status: 400 });
  }

  // Payment is cryptographically confirmed. Persist the order so the
  // success page (and any future order lookup) has something real to
  // show — if we don't have enough to record it (no items/address, or
  // an already-recorded order), verification itself still succeeded.
  if (items && address) {
    try {
      const existing = await getOrderByRazorpayOrderId(razorpayOrderId);
      if (!existing) {
        const totals = await computeOrderTotals(items);
        await appendOrder({
          id: randomUUID(),
          razorpayOrderId,
          razorpayPaymentId,
          itemsSubtotal: totals.itemsSubtotalInRupees,
          shipping: totals.shippingInRupees,
          amount: totals.amountInRupees,
          currency: "INR",
          address,
          items: totals.lineItems,
          status: "paid",
          createdAt: new Date().toISOString(),
        });
        // Only runs once per order, since it's inside the !existing
        // guard above — a retried verify-payment call for an order
        // already recorded won't double-decrement stock.
        await decrementStock(items);
      }
    } catch (error) {
      // A verified payment should never be reported as failed just
      // because persistence had an issue — log it and move on.
      if (error instanceof PricingError) {
        console.error(
          `[orders] Could not price order ${razorpayOrderId} for storage:`,
          error
        );
      } else {
        console.error(`[orders] Failed to store order ${razorpayOrderId}:`, error);
      }
    }
  }

  return NextResponse.json({ verified: true, orderId: razorpayOrderId });
}
