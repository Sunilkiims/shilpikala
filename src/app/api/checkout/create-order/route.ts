import { NextResponse } from "next/server";
import { getProductById } from "@/lib/catalog";
import { isRazorpayConfigured } from "@/lib/razorpay/config";
import { getRazorpayClient } from "@/lib/razorpay/client";
import type { Address } from "@/types/woocommerce";

type CreateOrderRequestItem = {
  productId: number;
  quantity: number;
};

type CreateOrderRequestBody = {
  items: CreateOrderRequestItem[];
  address: Address;
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

  // Recompute the total from the catalog — the client's cart is never
  // trusted for pricing, only for which products and quantities to buy.
  let amountInRupees = 0;
  for (const requestedItem of body.items) {
    const quantity = Math.floor(Number(requestedItem.quantity));
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 99) {
      return NextResponse.json(
        { error: "invalid_quantity", productId: requestedItem.productId },
        { status: 400 }
      );
    }

    const product = await getProductById(Number(requestedItem.productId));
    if (!product) {
      return NextResponse.json(
        { error: "unknown_product", productId: requestedItem.productId },
        { status: 400 }
      );
    }
    if (!product.inStock) {
      return NextResponse.json(
        { error: "out_of_stock", productId: requestedItem.productId },
        { status: 400 }
      );
    }

    const unitPrice = Number(
      product.onSale && product.salePrice ? product.salePrice : product.price
    );
    amountInRupees += unitPrice * quantity;
  }

  const amountInPaise = Math.round(amountInRupees * 100);

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
    });
  } catch (error) {
    console.error("[checkout] Razorpay order creation failed:", error);
    return NextResponse.json(
      { error: "order_creation_failed" },
      { status: 502 }
    );
  }
}
