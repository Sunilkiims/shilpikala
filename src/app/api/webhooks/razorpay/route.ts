import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { finalizeVerifiedPayment } from "@/lib/orders/finalize";
import { sendOrderStatusEmail } from "@/lib/orders/orderEmails";
import { getOrderByPaymentId, updateOrderFulfilment } from "@/lib/orders/store";

/**
 * Razorpay → us. This is the server-to-server confirmation that does not
 * depend on the customer's browser surviving the redirect after paying.
 *
 * Setup (Razorpay Dashboard → Settings → Webhooks):
 *   URL    https://<your-domain>/api/webhooks/razorpay
 *   Secret (any strong string) → RAZORPAY_WEBHOOK_SECRET
 *   Events payment.captured, order.paid, refund.processed, payment.failed
 *
 * Authenticity: HMAC-SHA256 of the RAW body, compared in constant time.
 * Retries are harmless — finalizeVerifiedPayment is idempotent.
 */

function validSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

type PaymentEntity = { id?: string; order_id?: string; method?: string; status?: string };
type RefundEntity = { payment_id?: string };
type WebhookEvent = {
  event?: string;
  payload?: {
    payment?: { entity?: PaymentEntity };
    order?: { entity?: { id?: string } };
    refund?: { entity?: RefundEntity };
  };
};

export async function POST(request: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "webhook_not_configured" }, { status: 503 });
  }

  const raw = await request.text();
  if (!validSignature(raw, request.headers.get("x-razorpay-signature"), secret)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  let event: WebhookEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    switch (event.event) {
      case "payment.captured":
      case "order.paid": {
        const payment = event.payload?.payment?.entity;
        if (payment?.id && payment.order_id && (payment.status === undefined || payment.status === "captured")) {
          await finalizeVerifiedPayment({
            razorpayOrderId: payment.order_id,
            razorpayPaymentId: payment.id,
            ...(payment.method ? { paymentMethod: payment.method } : {}),
          });
        }
        break;
      }
      case "refund.processed": {
        const paymentId = event.payload?.refund?.entity?.payment_id;
        const order = paymentId ? await getOrderByPaymentId(paymentId) : undefined;
        if (order && order.status !== "refunded") {
          const updated = await updateOrderFulfilment(order.id, { status: "refunded" });
          if (updated) await sendOrderStatusEmail(updated, "refunded");
        }
        break;
      }
      case "payment.failed":
        // No order exists for a failed payment and nothing is sent: the
        // customer simply retries checkout. Logged for diagnosis only.
        console.warn(`[webhook] payment.failed for ${event.payload?.payment?.entity?.order_id ?? "unknown order"}`);
        break;
      default:
        break; // other events are acknowledged and ignored
    }
  } catch (error) {
    // A 500 makes Razorpay retry later, which is exactly what we want
    // when the database was briefly unavailable.
    console.error(`[webhook] Failed handling ${event.event}:`, error);
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
