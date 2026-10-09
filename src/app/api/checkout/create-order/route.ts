import { NextResponse } from "next/server";
import { isRazorpayConfigured } from "@/lib/razorpay/config";
import { getRazorpayClient } from "@/lib/razorpay/client";
import { computeOrderTotals, PricingError } from "@/lib/checkout/pricing";
import { sanitizeAddress } from "@/lib/checkout/address";
import { savePendingOrder } from "@/lib/orders/pendingStore";
import { isValidEmail } from "@/lib/utils/email";

type CreateOrderRequestBody = {
  items?: unknown;
  address?: unknown;
  email?: unknown;
};

function isItemList(value: unknown): value is { productId: number; quantity: number }[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => item !== null && typeof item === "object")
  );
}

/**
 * Prices the cart from the catalogue, creates the Razorpay order, and
 * saves a snapshot of exactly what was priced and charged. The snapshot
 * — not anything the browser says later — is what verify-payment
 * records, so the snapshot is saved BEFORE the browser is handed an
 * order it could pay for. If it can't be saved, no payment can start.
 */
export async function POST(request: Request) {
  if (!isRazorpayConfigured()) {
    return NextResponse.json({ error: "payment_not_configured" }, { status: 503 });
  }

  let body: CreateOrderRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!isItemList(body?.items)) {
    return NextResponse.json({ error: "empty_cart" }, { status: 400 });
  }
  const address = sanitizeAddress(body.address);
  if (!address) {
    return NextResponse.json({ error: "invalid_address" }, { status: 400 });
  }
  if (!isValidEmail(body.email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  const email = body.email;

  let totals;
  try {
    totals = await computeOrderTotals(body.items);
  } catch (error) {
    if (error instanceof PricingError) {
      return NextResponse.json(
        { error: error.code, productId: error.productId },
        { status: 400 }
      );
    }
    throw error;
  }

  const amountInPaise = Math.round(totals.amountInRupees * 100);

  let order;
  try {
    const razorpay = getRazorpayClient();
    order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      notes: {
        customerName: address.fullName,
        city: address.city,
      },
    });
  } catch (error) {
    console.error("[checkout] Razorpay order creation failed:", error);
    return NextResponse.json({ error: "order_creation_failed" }, { status: 502 });
  }

  try {
    await savePendingOrder({
      razorpayOrderId: order.id,
      items: totals.lineItems,
      itemsSubtotal: totals.itemsSubtotalInRupees,
      shipping: totals.shippingInRupees,
      amount: totals.amountInRupees,
      amountInPaise,
      customerEmail: email,
      address,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    // The Razorpay order exists but was never handed to the browser, so
    // it can't be paid — safe to abandon.
    console.error("[checkout] Could not save order snapshot:", error);
    return NextResponse.json({ error: "order_snapshot_failed" }, { status: 500 });
  }

  return NextResponse.json({
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    itemsSubtotal: totals.itemsSubtotalInRupees,
    shipping: totals.shippingInRupees,
  });
}
