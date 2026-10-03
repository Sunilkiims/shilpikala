import { NextResponse } from "next/server";
import { isRazorpayConfigured } from "@/lib/razorpay/config";
import { getRazorpayClient } from "@/lib/razorpay/client";
import { computeOrderTotals, PricingError } from "@/lib/checkout/pricing";
import { isValidEmail } from "@/lib/utils/email";
import type { Address } from "@/types/catalog";

type CreateOrderRequestItem = {
  productId: number;
  quantity: number;
};

type CreateOrderRequestBody = {
  items: CreateOrderRequestItem[];
  address: Address;
  email?: string;
};

function isAddress(value: unknown): value is Address {
  if (!value || typeof value !== "object") return false;
  const address = value as Record<string, unknown>;
  return (
    typeof address.fullName === "string" &&
    address.fullName.trim().length > 0 &&
    typeof address.line1 === "string" &&
    address.line1.trim().length > 0 &&
    typeof address.city === "string" &&
    address.city.trim().length > 0 &&
    typeof address.state === "string" &&
    address.state.trim().length > 0 &&
    typeof address.postalCode === "string" &&
    address.postalCode.trim().length > 0 &&
    typeof address.country === "string" &&
    address.country.trim().length > 0
  );
}

export async function POST(request: Request) {
  if (!isRazorpayConfigured()) {
    return NextResponse.json(
      { error: "payment_not_configured" },
      { status: 503 }
    );
  }

  let body: CreateOrderRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "empty_cart" }, { status: 400 });
  }
  if (!isAddress(body.address)) {
    return NextResponse.json({ error: "invalid_address" }, { status: 400 });
  }
  if (!isValidEmail(body.email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

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

  try {
    const razorpay = getRazorpayClient();
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      notes: {
        customerName: body.address.fullName,
        city: body.address.city,
      },
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      itemsSubtotal: totals.itemsSubtotalInRupees,
      shipping: totals.shippingInRupees,
    });
  } catch (error) {
    console.error("[checkout] Razorpay order creation failed:", error);
    return NextResponse.json(
      { error: "order_creation_failed" },
      { status: 502 }
    );
  }
}
