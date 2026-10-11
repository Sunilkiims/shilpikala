import { getRazorpayClient } from "@/lib/razorpay/client";
import { isRazorpayConfigured } from "@/lib/razorpay/config";

/**
 * The only file that talks to Razorpay about return refunds, so tests can
 * replace it and nothing else needs to know the SDK. Uses the app's existing
 * Razorpay client and keys — no second integration.
 */

export type GatewayRefund = { id: string; status: "pending" | "processed" | "failed"; amount?: number };

export type CreateRefundResult =
  | { ok: true; refund: GatewayRefund }
  /** `definite`: Razorpay answered and refused. Otherwise we don't know if it was applied. */
  | { ok: false; definite: boolean; reason: string };

export function gatewayConfigured(): boolean {
  return isRazorpayConfigured();
}

function errorReason(error: unknown): { definite: boolean; reason: string } {
  const e = error as { statusCode?: number; error?: { description?: string }; message?: string } | null;
  if (e && typeof e.statusCode === "number") {
    return { definite: e.statusCode >= 400 && e.statusCode < 500, reason: (e.error?.description ?? e.message ?? "Refund rejected by the gateway").slice(0, 300) };
  }
  return { definite: false, reason: ((e?.message as string | undefined) ?? "No response from the gateway").slice(0, 300) };
}

const toRefund = (r: { id: string; status?: string; amount?: number }): GatewayRefund => ({
  id: r.id,
  status: r.status === "processed" ? "processed" : r.status === "failed" ? "failed" : "pending",
  ...(typeof r.amount === "number" ? { amount: r.amount } : {}),
});

export async function createGatewayRefund(input: {
  paymentId: string;
  amountPaise: number;
  /** Our refund_transactions id — echoed back in the gateway's notes so an unanswered call can be reconciled. */
  refundTxnId: string;
  requestId: string;
}): Promise<CreateRefundResult> {
  if (!isRazorpayConfigured()) return { ok: false, definite: true, reason: "Razorpay is not configured on this server" };
  try {
    const refund = await getRazorpayClient().payments.refund(input.paymentId, {
      amount: input.amountPaise,
      speed: "normal",
      receipt: input.refundTxnId,
      notes: { refund_txn_id: input.refundTxnId, return_request: input.requestId },
    });
    return { ok: true, refund: toRefund(refund as { id: string; status?: string; amount?: number }) };
  } catch (error) {
    return { ok: false, ...errorReason(error) };
  }
}

/** Looks for a refund we may have created without seeing the answer. */
export async function findGatewayRefund(paymentId: string, refundTxnId: string): Promise<GatewayRefund | null> {
  if (!isRazorpayConfigured()) return null;
  const list = await getRazorpayClient().payments.fetchMultipleRefund(paymentId, { count: 100 });
  const match = (list.items as { id: string; status?: string; amount?: number; notes?: Record<string, unknown> | unknown[] }[]).find(
    (r) => !Array.isArray(r.notes) && r.notes?.refund_txn_id === refundTxnId
  );
  return match ? toRefund(match) : null;
}

export async function fetchGatewayRefund(refundId: string): Promise<GatewayRefund | null> {
  if (!isRazorpayConfigured()) return null;
  const refund = await getRazorpayClient().refunds.fetch(refundId);
  return toRefund(refund as { id: string; status?: string; amount?: number });
}
