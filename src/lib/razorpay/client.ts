import Razorpay from "razorpay";
import { razorpayConfig } from "@/lib/razorpay/config";

let instance: Razorpay | null = null;

/**
 * Server-only. Throws if called without keys configured — callers in
 * the API routes check `isRazorpayConfigured()` first and return a
 * clean 503 instead of letting this throw reach the client.
 */
export function getRazorpayClient(): Razorpay {
  if (!instance) {
    instance = new Razorpay({
      key_id: razorpayConfig.keyId,
      key_secret: razorpayConfig.keySecret,
    });
  }
  return instance;
}
