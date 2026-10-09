import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isRazorpayConfigured } from "@/lib/razorpay/config";
import { verifyPaymentSignature } from "@/lib/razorpay/verify";
import { appendOrder, getOrderByRazorpayOrderId } from "@/lib/orders/store";
import { deletePendingOrder, getPendingOrder } from "@/lib/orders/pendingStore";
import { decrementStock } from "@/lib/store/catalogStore";
import { sendEmail } from "@/lib/email/send";
import { emailConfig, isAdminNotificationConfigured } from "@/lib/email/config";
import { adminOrderAlertEmail, orderConfirmationEmail } from "@/lib/email/templates";
import { isValidEmail } from "@/lib/utils/email";
import type { StoredOrder } from "@/lib/orders/types";

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
    await recordOrder(razorpayOrderId, razorpayPaymentId);
  } catch (error) {
    console.error(`[orders] Failed to record paid order ${razorpayOrderId}:`, error);
  }

  return NextResponse.json({ verified: true, orderId: razorpayOrderId });
}

async function recordOrder(razorpayOrderId: string, razorpayPaymentId: string) {
  // Replays (double-click, retry, refresh) are a no-op.
  if (await getOrderByRazorpayOrderId(razorpayOrderId)) return;

  const pending = await getPendingOrder(razorpayOrderId);
  if (!pending) {
    // A genuine payment we have no snapshot for (storage lost, or a
    // signature for an order this server never created). Don't invent
    // an order from client data — flag it for manual reconciliation.
    console.error(
      `[orders] RECONCILE: payment ${razorpayPaymentId} for Razorpay order ` +
        `${razorpayOrderId} verified, but no order snapshot exists.`
    );
    return;
  }

  const order: StoredOrder = {
    id: randomUUID(),
    razorpayOrderId,
    razorpayPaymentId,
    itemsSubtotal: pending.itemsSubtotal,
    shipping: pending.shipping,
    amount: pending.amount,
    currency: "INR",
    customerEmail: pending.customerEmail,
    address: pending.address,
    items: pending.items,
    status: "paid",
    createdAt: new Date().toISOString(),
  };

  // The one critical step. If this throws, the caller logs it.
  await appendOrder(order);

  // Everything below is best-effort and independent: the order is
  // already safely recorded, so one failing must not block the others.
  try {
    await decrementStock(
      pending.items.map(({ productId, quantity }) => ({ productId, quantity }))
    );
  } catch (error) {
    console.error(`[orders] Stock decrement failed for ${razorpayOrderId}:`, error);
  }

  try {
    await deletePendingOrder(razorpayOrderId);
  } catch (error) {
    console.error(`[orders] Snapshot cleanup failed for ${razorpayOrderId}:`, error);
  }

  if (isValidEmail(order.customerEmail)) {
    const confirmation = orderConfirmationEmail(order);
    await sendEmail({
      to: order.customerEmail,
      subject: confirmation.subject,
      html: confirmation.html,
    });
  }
  if (isAdminNotificationConfigured()) {
    const alert = adminOrderAlertEmail(order);
    await sendEmail({
      to: emailConfig.adminNotificationEmail,
      subject: alert.subject,
      html: alert.html,
    });
  }
}
