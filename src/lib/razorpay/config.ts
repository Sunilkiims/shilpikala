export const razorpayConfig = {
  keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "",
  keySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
};

export function isRazorpayConfigured(): boolean {
  return Boolean(razorpayConfig.keyId && razorpayConfig.keySecret);
}
