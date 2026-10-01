import { NextResponse } from "next/server";
import { isRazorpayConfigured } from "@/lib/razorpay/config";
import { verifyPaymentSignature } from "@/lib/razorpay/verify";

type VerifyRequestBody = {
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
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

  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = body;
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

  return NextResponse.json({ verified: true, orderId: razorpayOrderId });
}
