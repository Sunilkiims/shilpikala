import { createHmac, timingSafeEqual } from "node:crypto";
import { razorpayConfig } from "@/lib/razorpay/config";

type VerifyPaymentInput = {
  orderId: string;
  paymentId: string;
  signature: string;
};

/**
 * Razorpay's documented verification scheme: HMAC-SHA256 of
 * `${order_id}|${payment_id}` using the account's key secret, compared
 * to the signature the client received from the checkout widget.
 * Pure function — no network calls — so it's covered by a unit test.
 */
export function verifyPaymentSignature({
  orderId,
  paymentId,
  signature,
}: VerifyPaymentInput): boolean {
  const expected = createHmac("sha256", razorpayConfig.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "utf8");
  const signatureBuffer = Buffer.from(signature, "utf8");

  if (expectedBuffer.length !== signatureBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, signatureBuffer);
}
