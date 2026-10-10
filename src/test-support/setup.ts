import { vi } from "vitest";

// Never reach Razorpay from tests.
vi.mock("@/lib/razorpay/payment", () => ({
  fetchPaymentMethod: vi.fn(async () => undefined),
}));
