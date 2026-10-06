import { createHmac } from "node:crypto";
import { describe, it, expect, beforeEach, vi } from "vitest";

const TEST_SECRET = "test_secret_for_verify_spec";

function computeSignature(orderId: string, paymentId: string, secret: string) {
  return createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
}

// razorpayConfig reads RAZORPAY_KEY_SECRET at module-load time, so the
// env var must be stubbed and the module freshly imported per test.
async function loadVerify() {
  vi.resetModules();
  vi.stubEnv("RAZORPAY_KEY_SECRET", TEST_SECRET);
  const mod = await import("@/lib/razorpay/verify");
  return mod.verifyPaymentSignature;
}

describe("verifyPaymentSignature", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts a genuinely valid signature", async () => {
    const verifyPaymentSignature = await loadVerify();
    const orderId = "order_abc123";
    const paymentId = "pay_xyz789";
    const signature = computeSignature(orderId, paymentId, TEST_SECRET);

    expect(verifyPaymentSignature({ orderId, paymentId, signature })).toBe(true);
  });

  it("rejects a tampered order id", async () => {
    const verifyPaymentSignature = await loadVerify();
    const signature = computeSignature("order_abc123", "pay_xyz789", TEST_SECRET);

    expect(
      verifyPaymentSignature({
        orderId: "order_TAMPERED",
        paymentId: "pay_xyz789",
        signature,
      })
    ).toBe(false);
  });

  it("rejects a tampered payment id", async () => {
    const verifyPaymentSignature = await loadVerify();
    const signature = computeSignature("order_abc123", "pay_xyz789", TEST_SECRET);

    expect(
      verifyPaymentSignature({
        orderId: "order_abc123",
        paymentId: "pay_TAMPERED",
        signature,
      })
    ).toBe(false);
  });

  it("rejects a signature computed with the wrong secret", async () => {
    const verifyPaymentSignature = await loadVerify();
    const signature = computeSignature("order_abc123", "pay_xyz789", "wrong_secret");

    expect(
      verifyPaymentSignature({
        orderId: "order_abc123",
        paymentId: "pay_xyz789",
        signature,
      })
    ).toBe(false);
  });

  it("rejects a garbage signature without throwing", async () => {
    const verifyPaymentSignature = await loadVerify();

    expect(
      verifyPaymentSignature({
        orderId: "order_abc123",
        paymentId: "pay_xyz789",
        signature: "not-even-hex",
      })
    ).toBe(false);
  });
});
