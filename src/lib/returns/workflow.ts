import { customerOwnsOrder } from "@/lib/invoices/service";
import { sanitizeAddress } from "@/lib/checkout/address";
import { getOrderByReference } from "@/lib/orders/store";
import {
  isPayoutEncryptionConfigured,
  REASONS,
  REFUND_METHODS,
  REQUEST_TYPES,
  type RefundMethod,
  type RequestType,
} from "@/lib/returns/config";
import { encryptPayout } from "@/lib/returns/crypto";
import { validateEvidence } from "@/lib/returns/evidence";
import { alertAdmin, notifyReturn } from "@/lib/returns/notify";
import {
  applyWebhookRefund,
  recordManualPayout,
  startRefund,
  syncRefund,
  type RefundOutcome,
} from "@/lib/returns/refunds";
import { dispatchReplacement, markReplacementDelivered, startReplacement, type ReplacementOutcome } from "@/lib/returns/replacements";
import { addHistoryNote, createReturnRequest, getReturnRequest, transitionStatus } from "@/lib/returns/store";
import { CUSTOMER_CANCELLABLE, ReturnError, type ReturnRequest, type ReturnStatus } from "@/lib/returns/types";

type Customer = { id: number; name: string; email: string; emailVerified: boolean };

// ---- customer side --------------------------------------------------------

const UPI = /^[\w.\-]{2,64}@[A-Za-z][A-Za-z0-9]{1,31}$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;

function payoutFrom(method: RefundMethod, raw: unknown): string | undefined {
  if (method === "original") return undefined;
  if (!isPayoutEncryptionConfigured()) throw new ReturnError("payout_method_unavailable", 400);
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  if (method === "upi") {
    const upi = str(d.upiId, 80);
    if (!UPI.test(upi)) throw new ReturnError("invalid_upi", 400);
    return encryptPayout(JSON.stringify({ upiId: upi }));
  }
  const holder = str(d.accountHolder, 80);
  const account = str(d.accountNumber, 24).replace(/\s+/g, "");
  const ifsc = str(d.ifsc, 11).toUpperCase();
  if (!holder || !/^\d{9,18}$/.test(account) || !IFSC.test(ifsc)) throw new ReturnError("invalid_bank_details", 400);
  return encryptPayout(JSON.stringify({ accountHolder: holder, accountNumber: account, ifsc }));
}

export type SubmitInput = {
  orderReference: string;
  type: unknown;
  reason: unknown;
  description: unknown;
  items: unknown;
  pickupAddress: unknown;
  refundMethod: unknown;
  payout: unknown;
  files: { name: string; data: Buffer }[];
};

/** Validates everything the customer sent, re-checks eligibility on the server, stores the request and sends the emails. */
export async function submitReturnRequest(customer: Customer, input: SubmitInput): Promise<ReturnRequest> {
  const order = await getOrderByReference(input.orderReference);
  // Someone else's order answers exactly like a missing one.
  if (!order || !customerOwnsOrder(customer, order)) throw new ReturnError("order_not_found", 404);

  if (typeof input.type !== "string" || !REQUEST_TYPES.includes(input.type as RequestType)) throw new ReturnError("invalid_type", 400);
  const type = input.type as RequestType;
  if (typeof input.reason !== "string" || !REASONS.some((r) => r.value === input.reason)) throw new ReturnError("invalid_reason", 400);
  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (description.length < 10) throw new ReturnError("description_too_short", 400);
  if (description.length > 1500) throw new ReturnError("description_too_long", 400);

  if (!Array.isArray(input.items) || input.items.length === 0 || input.items.length > 50) throw new ReturnError("no_items", 400);
  const items = input.items.map((raw) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    return { productId: Number(r.productId), quantity: Number(r.quantity) };
  });
  if (items.some((i) => !Number.isInteger(i.productId) || !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 99)) {
    throw new ReturnError("invalid_quantity", 400);
  }

  const pickupAddress = sanitizeAddress(input.pickupAddress);
  if (!pickupAddress) throw new ReturnError("invalid_address", 400);

  const refundMethod = (input.refundMethod === undefined || input.refundMethod === "" ? "original" : input.refundMethod) as RefundMethod;
  if (!REFUND_METHODS.includes(refundMethod)) throw new ReturnError("invalid_refund_method", 400);
  // A replacement involves no refund, so no payout details are collected for it.
  const effectiveMethod: RefundMethod = type === "return" ? refundMethod : "original";
  const refundPayoutEnc = type === "return" ? payoutFrom(effectiveMethod, input.payout) : undefined;

  const evidence = validateEvidence(input.files);
  if (!evidence.some((e) => e.kind === "image")) throw new ReturnError("image_required", 400);

  const request = await createReturnRequest({
    order,
    customer: { id: customer.id, name: customer.name },
    type,
    reason: input.reason,
    description,
    items,
    pickupAddress,
    refundMethod: effectiveMethod,
    ...(refundPayoutEnc ? { refundPayoutEnc } : {}),
    evidence,
  });

  await notifyReturn(request.id, "submitted", { adminEvent: "submitted" });
  return request;
}

/** The customer's own cancellation — only before pickup is arranged. */
export async function cancelReturnByCustomer(requestId: string): Promise<ReturnRequest> {
  const request = await getReturnRequest(requestId);
  if (!request) throw new ReturnError("not_found", 404);
  if (!CUSTOMER_CANCELLABLE.includes(request.status)) throw new ReturnError("cannot_cancel", 409);
  await transitionStatus(request.id, request.status, "cancelled", "customer", "Cancelled by the customer");
  await notifyReturn(request.id, "cancelled", { adminEvent: "cancelled" });
  return (await getReturnRequest(request.id)) as ReturnRequest;
}

export function customerOwnsRequest(customer: Customer, request: ReturnRequest): boolean {
  if (request.customerId === customer.id) return true;
  return customer.emailVerified && request.customerEmail.toLowerCase() === customer.email.toLowerCase();
}

// ---- admin side -----------------------------------------------------------

export const ADMIN_ACTIONS = [
  "review", "approve", "reject", "schedule_pickup", "pickup_failed", "mark_picked_up", "start_inspection",
  "inspection_pass", "inspection_fail", "retry_refund", "alt_refund", "sync_refund", "record_payout",
  "retry_replacement", "dispatch_replacement", "mark_replacement_delivered", "cancel", "note",
] as const;
export type AdminActionName = (typeof ADMIN_ACTIONS)[number];

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function refundEmails(outcome: RefundOutcome, started: boolean): Promise<void> {
  const id = outcome.request.id;
  const suffix = outcome.refund.id;
  return (async () => {
    if (started) await notifyReturn(id, "refund_initiated", { dedupeSuffix: suffix });
    if (outcome.result === "completed") await notifyReturn(id, "refund_completed", { dedupeSuffix: suffix });
    if (outcome.result === "failed") {
      await alertAdmin(id, "refund_failed", outcome.refund.failureReason, suffix);
    }
  })();
}

async function replacementEmails(outcome: ReplacementOutcome): Promise<void> {
  if (outcome.ok) return; // "processing" needs no mail; dispatch/delivery have their own
  await notifyReturn(outcome.request.id, "replacement_unavailable", {
    adminEvent: "replacement_unavailable",
    adminDetail: `Out of stock: ${outcome.unavailable.join(", ")}`,
    dedupeSuffix: String(outcome.request.updatedAt),
  });
}

/** Webhook entry for refund.processed / refund.failed. */
export async function handleRefundWebhook(entity: Parameters<typeof applyWebhookRefund>[0], failed: boolean): Promise<boolean> {
  const outcome = await applyWebhookRefund(entity, failed);
  if (!outcome) return false;
  if (outcome.changed) await refundEmails(outcome, false);
  return true;
}

function must(request: ReturnRequest, allowed: readonly ReturnStatus[]): void {
  if (!allowed.includes(request.status)) throw new ReturnError("invalid_transition", 409, `${request.status}`);
}

/**
 * Every admin button goes through here. The status graph (`TRANSITIONS`) is
 * enforced inside the store, so even a crafted request cannot skip a step.
 */
export async function executeAdminAction(
  requestId: string,
  action: AdminActionName,
  body: Record<string, unknown>
): Promise<ReturnRequest> {
  const request = await getReturnRequest(requestId);
  if (!request) throw new ReturnError("not_found", 404);
  const note = text(body.note, 500) || undefined;
  const step = (to: ReturnStatus, n?: string, patch = {}) => transitionStatus(request.id, request.status, to, "admin", n, patch);

  switch (action) {
    case "review":
      must(request, ["submitted"]);
      await step("under_review", note);
      break;
    case "approve":
      must(request, ["submitted", "under_review"]);
      await step("approved", note);
      await notifyReturn(request.id, "approved");
      break;
    case "reject": {
      const reason = text(body.reason, 500);
      if (reason.length < 5) throw new ReturnError("rejection_reason_required", 400);
      must(request, ["submitted", "under_review", "inspection_failed"]);
      await step("rejected", reason, { rejectionReason: reason });
      await notifyReturn(request.id, "rejected");
      break;
    }
    case "schedule_pickup": {
      must(request, ["approved", "pickup_failed"]);
      const when = new Date(typeof body.scheduledFor === "string" ? body.scheduledFor : "");
      if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() - 5 * 60_000 || when.getTime() > Date.now() + 30 * 86_400_000) {
        throw new ReturnError("invalid_pickup_date", 400);
      }
      await step("pickup_scheduled", note, {
        pickupScheduledFor: when.toISOString(),
        ...(text(body.courier, 60) ? { pickupCourier: text(body.courier, 60) } : {}),
        ...(text(body.trackingNumber, 100) ? { pickupTracking: text(body.trackingNumber, 100) } : {}),
      });
      await notifyReturn(request.id, "pickup_scheduled", { dedupeSuffix: when.toISOString() });
      break;
    }
    case "pickup_failed":
      must(request, ["pickup_scheduled"]);
      await step("pickup_failed", note ?? "Pickup could not be completed");
      break;
    case "mark_picked_up":
      must(request, ["pickup_scheduled"]);
      await step("picked_up", note);
      await notifyReturn(request.id, "picked_up");
      break;
    case "start_inspection":
      must(request, ["picked_up"]);
      await step("inspection", note);
      break;
    case "inspection_fail":
      must(request, ["inspection"]);
      await step("inspection_failed", note);
      await notifyReturn(request.id, "inspection_failed");
      break;
    case "inspection_pass":
      must(request, ["inspection", "inspection_failed"]);
      await notifyReturn(request.id, "inspection_passed", { dedupeSuffix: request.status });
      if (request.type === "return") {
        await refundEmails(await startRefund(request.id, "admin", note ?? "Inspection passed"), true);
      } else {
        await replacementEmails(await startReplacement(request.id, "admin", note ?? "Inspection passed"));
      }
      break;
    case "retry_refund":
      must(request, ["refund_failed"]);
      await refundEmails(await startRefund(request.id, "admin", note ?? "Refund retried"), true);
      break;
    case "alt_refund":
      must(request, ["replacement_unavailable"]);
      await refundEmails(await startRefund(request.id, "admin", note ?? "Refunded instead of replacing"), true);
      break;
    case "sync_refund": {
      must(request, ["refund_initiated"]);
      const result = await syncRefund(request.id);
      if ("changed" in result) await refundEmails(result, false);
      else if (result.result === "not_found_at_gateway") await addHistoryNote(request.id, request.status, "admin", "Checked the gateway: no matching refund found yet");
      break;
    }
    case "record_payout": {
      must(request, ["refund_initiated"]);
      const outcome = await recordManualPayout(request.id, text(body.reference, 100));
      await refundEmails(outcome, false);
      break;
    }
    case "retry_replacement":
      must(request, ["replacement_unavailable"]);
      await replacementEmails(await startReplacement(request.id, "admin", note ?? "Replacement retried"));
      break;
    case "dispatch_replacement": {
      must(request, ["replacement_processing"]);
      await dispatchReplacement(request.id, {
        ...(text(body.carrier, 60) ? { carrier: text(body.carrier, 60) } : {}),
        ...(text(body.carrierTracking, 100) ? { carrierTracking: text(body.carrierTracking, 100) } : {}),
      });
      await notifyReturn(request.id, "replacement_dispatched");
      break;
    }
    case "mark_replacement_delivered":
      must(request, ["replacement_processing"]);
      await markReplacementDelivered(request.id);
      await notifyReturn(request.id, "replacement_delivered");
      break;
    case "cancel":
      must(request, ["submitted", "under_review", "approved", "pickup_scheduled", "pickup_failed"]);
      await step("cancelled", note ?? "Cancelled by admin");
      await notifyReturn(request.id, "cancelled");
      break;
    case "note": {
      if (!note) throw new ReturnError("note_required", 400);
      await addHistoryNote(request.id, request.status, "admin", note);
      break;
    }
  }
  return (await getReturnRequest(request.id)) as ReturnRequest;
}
