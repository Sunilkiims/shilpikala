import { getRazorpayClient } from "@/lib/razorpay/client";
import { isRazorpayConfigured } from "@/lib/razorpay/config";

/**
 * Best-effort lookup of how a customer paid ("upi", "card", …) for the
 * order confirmation. Never throws and never waits long: a missing
 * payment method must not delay or fail an order.
 */
export async function fetchPaymentMethod(paymentId: string): Promise<string | undefined> {
  if (!isRazorpayConfigured()) return undefined;
  try {
    const payment = await Promise.race([
      getRazorpayClient().payments.fetch(paymentId),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000)),
    ]);
    const method = (payment as { method?: unknown }).method;
    return typeof method === "string" && method ? method : undefined;
  } catch (error) {
    console.warn(`[orders] Could not look up payment method for ${paymentId}:`, (error as Error).message);
    return undefined;
  }
}
