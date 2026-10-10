import { NextResponse } from "next/server";
import { isRazorpayConfigured } from "@/lib/razorpay/config";
import { verifyPaymentSignature } from "@/lib/razorpay/verify";
import { finalizeVerifiedPayment } from "@/lib/orders/finalize";

type VerifyRequestBody = {
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
};

/**
 * Confirms a payment and records the order.
 *
 * The signature proves Razorpay took a payment for this order id — it
 * says nothing about what was in the cart. So the order is recorded
 * from the snapshot saved at create-order time (what was actually
 * priced and charged). Anything else in the request body (items,
 * address, email…) is deliberately ignored: the browser is not a
 * trustworthy source for what was bought.
 */
export async function POST(request: Request) {
  if (!isRazorpayConfigured()) {
    return NextResponse.json({ error: "payment_not_configured" }, { status: 503 });
  }

  let body: VerifyRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = body ?? {};
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

  // From here the payment is genuine, so we always answer verified:true —
  // a problem recording the order must never look like a failed payment.
  try {
    await finalizeVerifiedPayment({ razorpayOrderId, razorpayPaymentId });
  } catch (error) {
    console.error(`[orders] Failed to record paid order ${razorpayOrderId}:`, error);
  }

  return NextResponse.json({ verified: true, orderId: razorpayOrderId });
}
