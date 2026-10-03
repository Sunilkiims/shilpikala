import { NextResponse } from "next/server";
import { getOrderById } from "@/lib/orders/store";

type TrackOrderRequestBody = {
  orderId?: string;
  email?: string;
};

/**
 * Deliberately returns the same generic "not found" whether the order
 * reference doesn't exist, or it exists but the email doesn't match —
 * never reveals which, so this can't be used to enumerate valid order
 * references or confirm whether an email placed an order.
 */
export async function POST(request: Request) {
  let body: TrackOrderRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";

  if (!orderId || !email) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const order = await getOrderById(orderId);

  if (!order || order.customerEmail.toLowerCase() !== email.toLowerCase()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Return only what a customer needs to see — not the Razorpay
  // identifiers, which are more internal/operational detail.
  return NextResponse.json({
    order: {
      id: order.id,
      status: order.status,
      createdAt: order.createdAt,
      itemsSubtotal: order.itemsSubtotal,
      shipping: order.shipping,
      amount: order.amount,
      items: order.items,
      address: order.address,
    },
  });
}
