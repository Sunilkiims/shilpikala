import { getDb } from "@/lib/db";
import type { Db } from "@/lib/db/client";
import { iso, isUniqueViolation, num } from "@/lib/db/rows";
import { getOrderByIdWith } from "@/lib/orders/store";
import { isSellerFault } from "@/lib/returns/config";
import { computeRefundPaise } from "@/lib/returns/eligibility";
import { createGatewayRefund, fetchGatewayRefund, findGatewayRefund, type GatewayRefund } from "@/lib/returns/gateway";
import { getReturnRequest, newRefundId, transitionStatus } from "@/lib/returns/store";
import { ReturnError, type RefundStatus, type RefundTransaction, type ReturnRequest, type ReturnStatus } from "@/lib/returns/types";

type RefundRow = {
  id: string; request_id: string; order_id: string; amount_paise: number; method: "razorpay" | "manual";
  status: RefundStatus; idempotency_key: string; razorpay_payment_id: string | null; razorpay_refund_id: string | null;
  payout_reference: string | null; failure_reason: string | null; created_at: Date | string; updated_at: Date | string;
  completed_at: Date | string | null;
};

function toRefund(r: RefundRow): RefundTransaction {
  return {
    id: r.id, requestId: r.request_id, orderId: r.order_id, amountPaise: num(r.amount_paise), method: r.method,
    status: r.status, idempotencyKey: r.idempotency_key,
    ...(r.razorpay_payment_id ? { razorpayPaymentId: r.razorpay_payment_id } : {}),
    ...(r.razorpay_refund_id ? { razorpayRefundId: r.razorpay_refund_id } : {}),
    ...(r.payout_reference ? { payoutReference: r.payout_reference } : {}),
    ...(r.failure_reason ? { failureReason: r.failure_reason } : {}),
    createdAt: iso(r.created_at), updatedAt: iso(r.updated_at),
    ...(r.completed_at ? { completedAt: iso(r.completed_at) } : {}),
  };
}

export async function listRefunds(requestId: string): Promise<RefundTransaction[]> {
  const db = await getDb();
  const res = await db.query<RefundRow>("SELECT * FROM refund_transactions WHERE request_id = $1 ORDER BY created_at, id", [requestId]);
  return res.rows.map(toRefund);
}

/** The refund that currently counts (not failed), else the latest attempt. */
export async function currentRefund(requestId: string): Promise<RefundTransaction | undefined> {
  const all = await listRefunds(requestId);
  return all.find((r) => r.status !== "failed") ?? all[all.length - 1];
}

export async function refundAmountFor(request: ReturnRequest, tx?: Db): Promise<number> {
  const db = tx ?? (await getDb());
  const order = await getOrderByIdWith(db, request.orderId);
  if (!order) throw new ReturnError("order_not_found", 404);
  return computeRefundPaise(order, request.items, isSellerFault(request.reason));
}

const REFUNDABLE_FROM: readonly ReturnStatus[] = ["inspection", "inspection_failed", "refund_failed", "replacement_unavailable"];

export type RefundOutcome = {
  /** False when nothing changed (duplicate webhook, already settled). */
  changed: boolean;
  result: "completed" | "failed" | "processing" | "unchanged";
  refund: RefundTransaction;
  request: ReturnRequest;
};

/**
 * Begins a refund for a request. Everything that decides "is this allowed
 * and how much" happens in ONE transaction that locks the request row, then
 * the gateway is called afterwards (never while holding a lock). Two
 * simultaneous calls cannot both pass: the second finds the request already
 * in "refund_initiated", and the unique "one live refund per request" index
 * is the backstop.
 */
export async function startRefund(
  requestId: string,
  actor: "admin" | "system",
  note?: string
): Promise<RefundOutcome> {
  const db = await getDb();
  const refundId = newRefundId();

  const prepared = await db.transaction(async (tx) => {
    const cur = await tx.query<{ status: ReturnStatus; refund_method: string }>(
      "SELECT status, refund_method FROM return_requests WHERE id = $1 FOR UPDATE",
      [requestId]
    );
    const row = cur.rows[0];
    if (!row) throw new ReturnError("not_found", 404);
    if (!REFUNDABLE_FROM.includes(row.status)) throw new ReturnError("invalid_transition", 409, `${row.status} → refund_initiated`);

    await transitionStatus(requestId, row.status, "refund_initiated", actor, note ?? "Refund started", {}, tx);

    const request = await loadRequestTx(tx, requestId);
    const order = await getOrderByIdWith(tx, request.orderId);
    if (!order) throw new ReturnError("order_not_found", 404);
    const amount = computeRefundPaise(order, request.items, isSellerFault(request.reason));
    if (amount <= 0) throw new ReturnError("nothing_to_refund", 409);

    // Never refund more than was captured for this order, across ALL its requests.
    const sum = await tx.query<{ total: number }>(
      "SELECT COALESCE(SUM(amount_paise),0)::int AS total FROM refund_transactions WHERE order_id = $1 AND status IN ('pending','processing','completed')",
      [order.id]
    );
    if (num(sum.rows[0].total) + amount > Math.round(order.amount * 100)) throw new ReturnError("refund_exceeds_paid", 409);

    const attempts = await tx.query<{ n: number }>("SELECT COUNT(*)::int AS n FROM refund_transactions WHERE request_id = $1", [requestId]);
    const attempt = num(attempts.rows[0].n) + 1;
    const method = request.refundMethod === "original" ? "razorpay" : "manual";
    try {
      await tx.query(
        `INSERT INTO refund_transactions (id, request_id, order_id, amount_paise, method, status, idempotency_key, razorpay_payment_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [refundId, requestId, order.id, amount, method, method === "razorpay" ? "pending" : "processing", `refund:${requestId}:${attempt}`, order.razorpayPaymentId]
      );
    } catch (error) {
      if (isUniqueViolation(error)) throw new ReturnError("refund_in_progress", 409);
      throw error;
    }
    return { method, amount, paymentId: order.razorpayPaymentId };
  });

  if (prepared.method === "manual") {
    return outcomeFor(refundId, "processing", true);
  }

  const gateway = await createGatewayRefund({
    paymentId: prepared.paymentId,
    amountPaise: prepared.amount,
    refundTxnId: refundId,
    requestId,
  });
  if (gateway.ok) {
    return recordRefundOutcome({ refundId }, { status: gateway.refund.status, gatewayRefundId: gateway.refund.id }, "gateway");
  }
  if (gateway.definite) {
    return recordRefundOutcome({ refundId }, { status: "failed", reason: gateway.reason }, "gateway");
  }
  // We don't know whether Razorpay applied it. Leave it pending — NOT failed, or a
  // retry could refund twice — and say so; "Sync" will find out.
  const dbNow = await getDb();
  await dbNow.query(
    "INSERT INTO return_status_history (request_id, from_status, to_status, actor, note, internal) VALUES ($1,'refund_initiated','refund_initiated','system',$2,true)",
    [requestId, `Gateway did not answer (${gateway.reason}). Use "Check gateway" to confirm before retrying.`]
  );
  return outcomeFor(refundId, "processing", true);
}

async function loadRequestTx(tx: Db, id: string): Promise<ReturnRequest> {
  // Minimal re-read inside the transaction (items + the fields refunds need).
  const r = await tx.query<Record<string, unknown>>("SELECT * FROM return_requests WHERE id = $1", [id]);
  const items = await tx.query<{ product_id: number; name: string; quantity: number; unit_price_paise: number }>(
    "SELECT product_id, name, quantity, unit_price_paise FROM return_request_items WHERE request_id = $1",
    [id]
  );
  const row = r.rows[0] as { id: string; order_id: string; reason: string; refund_method: ReturnRequest["refundMethod"] };
  return {
    id: row.id, orderId: row.order_id, reason: row.reason, refundMethod: row.refund_method,
    items: items.rows.map((i) => ({ productId: num(i.product_id), name: i.name, quantity: num(i.quantity), unitPricePaise: num(i.unit_price_paise) })),
  } as ReturnRequest;
}

async function outcomeFor(refundId: string, result: RefundOutcome["result"], changed: boolean): Promise<RefundOutcome> {
  const db = await getDb();
  const row = (await db.query<RefundRow>("SELECT * FROM refund_transactions WHERE id = $1", [refundId])).rows[0];
  const refund = toRefund(row);
  const request = await getReturnRequest(refund.requestId);
  if (!request) throw new ReturnError("not_found", 404);
  return { changed, result, refund, request };
}

/**
 * Applies what the gateway said about a refund. Idempotent: webhook retries,
 * a webhook racing the admin's "check gateway", and the immediate API answer
 * all converge on the same final state, and a refund that is already
 * completed is never touched again. "Completed" is only ever set from a
 * gateway answer saying processed (or, for UPI/bank, by recordManualPayout).
 */
export async function recordRefundOutcome(
  where: { refundId?: string; razorpayRefundId?: string },
  outcome: { status: "pending" | "processed" | "failed"; gatewayRefundId?: string; reason?: string },
  actor: "gateway" | "admin"
): Promise<RefundOutcome> {
  const db = await getDb();
  const settled = await db.transaction(async (tx) => {
    const found = await tx.query<RefundRow>(
      `SELECT * FROM refund_transactions WHERE ${where.refundId ? "id = $1" : "razorpay_refund_id = $1"} FOR UPDATE`,
      [where.refundId ?? where.razorpayRefundId]
    );
    const row = found.rows[0];
    if (!row) return null;
    if (row.status === "completed" || row.status === "failed") {
      return { id: row.id, result: "unchanged" as const, changed: false };
    }
    if (outcome.status === "processed") {
      await tx.query(
        "UPDATE refund_transactions SET status='completed', razorpay_refund_id = COALESCE($2, razorpay_refund_id), failure_reason=NULL, completed_at=now(), updated_at=now() WHERE id=$1",
        [row.id, outcome.gatewayRefundId ?? null]
      );
      await finishRequest(tx, row.request_id, "Refund confirmed by the payment gateway", actor);
      return { id: row.id, result: "completed" as const, changed: true };
    }
    if (outcome.status === "failed") {
      await tx.query(
        "UPDATE refund_transactions SET status='failed', razorpay_refund_id = COALESCE($2, razorpay_refund_id), failure_reason=$3, updated_at=now() WHERE id=$1",
        [row.id, outcome.gatewayRefundId ?? null, (outcome.reason ?? "Refund failed").slice(0, 300)]
      );
      const req = await tx.query<{ status: ReturnStatus }>("SELECT status FROM return_requests WHERE id = $1", [row.request_id]);
      if (req.rows[0]?.status === "refund_initiated") {
        await transitionStatus(row.request_id, "refund_initiated", "refund_failed", actor, `Refund failed: ${outcome.reason ?? "unknown reason"}`, {}, tx);
      }
      return { id: row.id, result: "failed" as const, changed: true };
    }
    await tx.query(
      "UPDATE refund_transactions SET status='processing', razorpay_refund_id = COALESCE($2, razorpay_refund_id), updated_at=now() WHERE id=$1",
      [row.id, outcome.gatewayRefundId ?? null]
    );
    return { id: row.id, result: "processing" as const, changed: row.status !== "processing" || Boolean(outcome.gatewayRefundId && !row.razorpay_refund_id) };
  });
  if (!settled) throw new ReturnError("refund_not_found", 404);
  return outcomeFor(settled.id, settled.result, settled.changed);
}

async function finishRequest(tx: Db, requestId: string, note: string, actor: "gateway" | "admin"): Promise<void> {
  const cur = await tx.query<{ status: ReturnStatus }>("SELECT status FROM return_requests WHERE id = $1", [requestId]);
  if (cur.rows[0]?.status === "refund_initiated") {
    // Payout details are no longer needed once the money has moved.
    await transitionStatus(requestId, "refund_initiated", "completed", actor, note, { clearPayout: true }, tx);
  }
}

/** UPI / bank refunds: the admin pays out by hand and records the bank reference. Not a gateway confirmation, and labelled as such. */
export async function recordManualPayout(requestId: string, reference: string): Promise<RefundOutcome> {
  const ref = reference.trim();
  if (ref.length < 4) throw new ReturnError("reference_required", 400);
  const db = await getDb();
  const refundId = await db.transaction(async (tx) => {
    const found = await tx.query<RefundRow>(
      "SELECT * FROM refund_transactions WHERE request_id = $1 AND status IN ('pending','processing') ORDER BY created_at DESC LIMIT 1 FOR UPDATE",
      [requestId]
    );
    const row = found.rows[0];
    if (!row) throw new ReturnError("refund_not_found", 404);
    if (row.method !== "manual") throw new ReturnError("gateway_refund_needs_gateway_confirmation", 409);
    await tx.query(
      "UPDATE refund_transactions SET status='completed', payout_reference=$2, completed_at=now(), updated_at=now() WHERE id=$1",
      [row.id, ref.slice(0, 100)]
    );
    await finishRequest(tx, requestId, `Manual payout recorded (reference ${ref.slice(0, 100)})`, "admin");
    return row.id;
  });
  return outcomeFor(refundId, "completed", true);
}

/** Asks Razorpay what happened to the live refund and applies the answer. */
export async function syncRefund(requestId: string): Promise<RefundOutcome | { result: "not_found_at_gateway" | "nothing_to_sync" }> {
  const db = await getDb();
  const res = await db.query<RefundRow>(
    "SELECT * FROM refund_transactions WHERE request_id = $1 AND status IN ('pending','processing') AND method = 'razorpay' ORDER BY created_at DESC LIMIT 1",
    [requestId]
  );
  const row = res.rows[0];
  if (!row) return { result: "nothing_to_sync" };

  let found: GatewayRefund | null = null;
  if (row.razorpay_refund_id) found = await fetchGatewayRefund(row.razorpay_refund_id);
  else if (row.razorpay_payment_id) found = await findGatewayRefund(row.razorpay_payment_id, row.id);

  if (found) {
    return recordRefundOutcome({ refundId: row.id }, { status: found.status, gatewayRefundId: found.id }, "gateway");
  }
  // Razorpay has no such refund. After a grace period that makes the attempt safely retryable.
  const ageMs = Date.now() - new Date(iso(row.created_at)).getTime();
  if (!row.razorpay_refund_id && ageMs > 2 * 60_000) {
    return recordRefundOutcome({ refundId: row.id }, { status: "failed", reason: "Not found at the payment gateway" }, "gateway");
  }
  return { result: "not_found_at_gateway" };
}

/** Webhook entry: finds our refund by Razorpay's id, or by the txn id we put in the notes. */
export async function applyWebhookRefund(entity: {
  id?: string; status?: string; notes?: unknown; error_description?: string;
}, failed: boolean): Promise<RefundOutcome | null> {
  if (!entity.id) return null;
  const notes = entity.notes && !Array.isArray(entity.notes) ? (entity.notes as Record<string, unknown>) : {};
  const txnId = typeof notes.refund_txn_id === "string" ? notes.refund_txn_id : undefined;
  const db = await getDb();
  const known = await db.query<{ id: string }>(
    "SELECT id FROM refund_transactions WHERE razorpay_refund_id = $1 OR ($2::text IS NOT NULL AND id = $2) LIMIT 1",
    [entity.id, txnId ?? null]
  );
  if (known.rowCount === 0) return null; // not one of ours (e.g. refunded from the Razorpay dashboard)
  return recordRefundOutcome(
    { refundId: known.rows[0].id },
    failed || entity.status === "failed"
      ? { status: "failed", gatewayRefundId: entity.id, reason: entity.error_description ?? "Refund failed at the gateway" }
      : { status: "processed", gatewayRefundId: entity.id },
    "gateway"
  );
}
