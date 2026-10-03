import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isRazorpayConfigured } from "@/lib/razorpay/config";
import { verifyPaymentSignature } from "@/lib/razorpay/verify";
import { computeOrderTotals, PricingError } from "@/lib/checkout/pricing";
import { appendOrder, getOrderByRazorpayOrderId } from "@/lib/orders/store";
import { decrementStock } from "@/lib/store/catalogStore";
import { sendEmail } from "@/lib/email/send";
import { isAdminNotificationConfigured } from "@/lib/email/config";
import { adminOrderAlertEmail, orderConfirmationEmail } from "@/lib/email/templates";
import { isValidEmail } from "@/lib/utils/email";
import { emailConfig } from "@/lib/email/config";
import type { Address } from "@/types/catalog";
import type { StoredOrder } from "@/lib/orders/types";

type VerifyRequestBody = {
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  items?: { productId: number; quantity: number }[];
  address?: Address;
  email?: string;
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

  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, items, address, email } =
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
        const order: StoredOrder = {
          id: randomUUID(),
          razorpayOrderId,
          razorpayPaymentId,
          itemsSubtotal: totals.itemsSubtotalInRupees,
          shipping: totals.shippingInRupees,
          amount: totals.amountInRupees,
          currency: "INR",
          customerEmail: typeof email === "string" ? email : "",
          address,
          items: totals.lineItems,
          status: "paid",
          createdAt: new Date().toISOString(),
        };
        await appendOrder(order);
        // Only runs once per order, since it's inside the !existing
        // guard above — a retried verify-payment call for an order
        // already recorded won't double-decrement stock or re-send mail.
        await decrementStock(items);

        // Email is a best-effort side effect of a payment that has
        // already succeeded and already been persisted above — a
        // send failure here must never change the response below.
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
