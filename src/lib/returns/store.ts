import { randomBytes } from "node:crypto";
import type { Address } from "@/types/catalog";
import { getDb } from "@/lib/db";
import type { Db } from "@/lib/db/client";
import { bytes, iso, isUniqueViolation, num } from "@/lib/db/rows";
import { getOrderByIdWith } from "@/lib/orders/store";
import type { StoredOrder } from "@/lib/orders/types";
import { isSellerFault, type RefundMethod, type RequestType } from "@/lib/returns/config";
import {
  DEFAULT_POLICY,
  evaluateEligibility,
  type OrderEligibility,
  type PolicyMap,
  type ProductPolicy,
} from "@/lib/returns/eligibility";
import type { EvidenceUpload } from "@/lib/returns/evidence";
import {
  canTransition,
  RELEASING_STATUSES,
  ReturnError,
  type EvidenceMeta,
  type ReturnItem,
  type ReturnRequest,
  type ReturnStatus,
  type StatusHistoryEntry,
} from "@/lib/returns/types";

// ---- ids ----------------------------------------------------------------

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
function code(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}
export const newRequestId = () => `RR-${code(8)}`;
export const newRefundId = () => `RF-${code(10)}`;
export const newShipmentId = () => `RS-${code(8)}`;
export const newReplacementTracking = () => `RPL-${code(10)}`;
const newTrackToken = () => randomBytes(24).toString("hex");

// ---- rows -> objects ------------------------------------------------------

type RequestRow = {
  id: string; order_id: string; customer_id: number | null; customer_email: string; customer_name: string;
  type: RequestType; reason: string; description: string; status: ReturnStatus; track_token: string;
  pickup_address: Address; refund_method: RefundMethod; refund_payout_enc: string | null;
  delivered_at: Date | string; deadline_at: Date | string; pickup_scheduled_for: Date | string | null;
  pickup_courier: string | null; pickup_tracking: string | null; rejection_reason: string | null;
  admin_note: string | null; created_at: Date | string; updated_at: Date | string;
};
type ItemRow = { request_id: string; product_id: number; name: string; quantity: number; unit_price_paise: number };

function toRequest(r: RequestRow, items: ItemRow[]): ReturnRequest {
  return {
    id: r.id,
    orderId: r.order_id,
    ...(r.customer_id !== null && r.customer_id !== undefined ? { customerId: num(r.customer_id) } : {}),
    customerEmail: r.customer_email,
    customerName: r.customer_name,
    type: r.type,
    reason: r.reason,
    description: r.description,
    status: r.status,
    trackToken: r.track_token,
    pickupAddress: r.pickup_address,
    refundMethod: r.refund_method,
    hasPayoutDetails: Boolean(r.refund_payout_enc),
    deliveredAt: iso(r.delivered_at),
    deadlineAt: iso(r.deadline_at),
    ...(r.pickup_scheduled_for ? { pickupScheduledFor: iso(r.pickup_scheduled_for) } : {}),
    ...(r.pickup_courier ? { pickupCourier: r.pickup_courier } : {}),
    ...(r.pickup_tracking ? { pickupTracking: r.pickup_tracking } : {}),
    ...(r.rejection_reason ? { rejectionReason: r.rejection_reason } : {}),
    ...(r.admin_note ? { adminNote: r.admin_note } : {}),
    items: items
      .filter((i) => i.request_id === r.id)
      .map((i) => ({ productId: num(i.product_id), name: i.name, quantity: num(i.quantity), unitPricePaise: num(i.unit_price_paise) })),
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

async function hydrateRequests(db: Db, rows: RequestRow[]): Promise<ReturnRequest[]> {
  if (rows.length === 0) return [];
  const items = await db.query<ItemRow>(
    "SELECT request_id, product_id, name, quantity, unit_price_paise FROM return_request_items WHERE request_id = ANY($1) ORDER BY id",
    [rows.map((r) => r.id)]
  );
  return rows.map((r) => toRequest(r, items.rows));
}

// ---- policies -------------------------------------------------------------

export async function loadPolicies(db: Db, productIds: number[]): Promise<PolicyMap> {
  const map: PolicyMap = new Map();
  if (productIds.length === 0) return map;
  const res = await db.query<{ product_id: number; returnable: boolean; replaceable: boolean; note: string | null }>(
    "SELECT product_id, returnable, replaceable, note FROM product_return_policies WHERE product_id = ANY($1)",
    [productIds]
  );
  for (const r of res.rows) {
    map.set(num(r.product_id), { returnable: r.returnable, replaceable: r.replaceable, ...(r.note ? { note: r.note } : {}) });
  }
  return map;
}

export type ProductPolicyRow = { productId: number; name: string; slug: string } & ProductPolicy & { custom: boolean };

export async function listProductPolicies(): Promise<ProductPolicyRow[]> {
  const db = await getDb();
  const res = await db.query<{ id: number; name: string; slug: string; returnable: boolean | null; replaceable: boolean | null; note: string | null }>(
    `SELECT p.id, p.name, p.slug, pol.returnable, pol.replaceable, pol.note
       FROM products p LEFT JOIN product_return_policies pol ON pol.product_id = p.id
      ORDER BY p.name`
  );
  return res.rows.map((r) => ({
    productId: num(r.id),
    name: r.name,
    slug: r.slug,
    returnable: r.returnable ?? DEFAULT_POLICY.returnable,
    replaceable: r.replaceable ?? DEFAULT_POLICY.replaceable,
    ...(r.note ? { note: r.note } : {}),
    custom: r.returnable !== null,
  }));
}

export async function getProductPolicy(productId: number): Promise<ProductPolicy> {
  const db = await getDb();
  return (await loadPolicies(db, [productId])).get(productId) ?? DEFAULT_POLICY;
}

export async function setProductPolicy(productId: number, policy: ProductPolicy): Promise<boolean> {
  const db = await getDb();
  const exists = await db.query("SELECT 1 FROM products WHERE id = $1", [productId]);
  if (exists.rowCount === 0) return false;
  await db.query(
    `INSERT INTO product_return_policies (product_id, returnable, replaceable, note, updated_at)
     VALUES ($1,$2,$3,$4, now())
     ON CONFLICT (product_id) DO UPDATE SET returnable = $2, replaceable = $3, note = $4, updated_at = now()`,
    [productId, policy.returnable, policy.replaceable, policy.note ?? null]
  );
  return true;
}

/** First uploaded photo per product, for order screens: productId → image id (served at /media/product-images/<id>). */
export async function getProductImageIds(productIds: number[]): Promise<Record<number, number>> {
  const ids = [...new Set(productIds)];
  if (ids.length === 0) return {};
  const db = await getDb();
  const res = await db.query<{ product_id: number; id: number }>(
    `SELECT DISTINCT ON (product_id) product_id, id FROM product_images
      WHERE product_id = ANY($1) ORDER BY product_id, position, id`,
    [ids]
  );
  return Object.fromEntries(res.rows.map((r) => [num(r.product_id), num(r.id)]));
}

// ---- eligibility (read side) ---------------------------------------------

async function heldQuantities(db: Db, orderId: string): Promise<Map<number, number>> {
  const res = await db.query<{ product_id: number; qty: number }>(
    `SELECT i.product_id, SUM(i.quantity)::int AS qty
       FROM return_request_items i JOIN return_requests r ON r.id = i.request_id
      WHERE r.order_id = $1 AND r.status <> ALL($2)
      GROUP BY i.product_id`,
    [orderId, [...RELEASING_STATUSES]]
  );
  return new Map(res.rows.map((r) => [num(r.product_id), num(r.qty)]));
}

export async function getOrderEligibility(order: StoredOrder, now = new Date()): Promise<OrderEligibility> {
  const db = await getDb();
  const [policies, held] = await Promise.all([
    loadPolicies(db, order.items.map((i) => i.productId)),
    heldQuantities(db, order.id),
  ]);
  return evaluateEligibility(order, policies, held, now);
}

// ---- create ---------------------------------------------------------------

export type CreateReturnInput = {
  order: StoredOrder;
  customer: { id: number; name: string };
  type: RequestType;
  reason: string;
  description: string;
  items: { productId: number; quantity: number }[];
  pickupAddress: Address;
  refundMethod: RefundMethod;
  /** Already encrypted. */
  refundPayoutEnc?: string;
  evidence: EvidenceUpload[];
  now?: Date;
};

/**
 * Creates a request after re-checking everything on the server, inside one
 * transaction that first locks the order row — so two simultaneous requests
 * for the same units serialise and the second one is refused.
 */
export async function createReturnRequest(input: CreateReturnInput): Promise<ReturnRequest> {
  const db = await getDb();
  const now = input.now ?? new Date();
  const id = newRequestId();

  await db.transaction(async (tx) => {
    const locked = await tx.query<{ id: string }>("SELECT id FROM orders WHERE id = $1 FOR UPDATE", [input.order.id]);
    if (locked.rowCount === 0) throw new ReturnError("order_not_found", 404);
    // Re-read inside the lock: the delivery status / time may have just changed.
    const fresh = await getOrderByIdWith(tx, input.order.id);
    if (!fresh) throw new ReturnError("order_not_found", 404);

    const [policies, held] = await Promise.all([
      loadPolicies(tx, fresh.items.map((i) => i.productId)),
      heldQuantities(tx, fresh.id),
    ]);
    const elig = evaluateEligibility(fresh, policies, held, now);
    if (elig.state !== "open") throw new ReturnError(elig.state, 409);

    const merged = new Map<number, number>();
    for (const it of input.items) merged.set(it.productId, (merged.get(it.productId) ?? 0) + it.quantity);
    if (merged.size === 0) throw new ReturnError("no_items", 400);

    const lines: ReturnItem[] = [];
    for (const [productId, quantity] of merged) {
      const line = elig.items.find((i) => i.productId === productId);
      if (!line) throw new ReturnError("item_not_in_order", 400);
      if (!Number.isInteger(quantity) || quantity < 1) throw new ReturnError("invalid_quantity", 400);
      if (input.type === "return" ? !line.policyReturnable : !line.policyReplaceable) {
        throw new ReturnError(input.type === "return" ? "not_returnable" : "not_replaceable", 409, line.name);
      }
      if (quantity > line.availableQty) throw new ReturnError("duplicate_request", 409, line.name);
      lines.push({ productId, name: line.name, quantity, unitPricePaise: line.unitPricePaise });
    }

    await tx.query(
      `INSERT INTO return_requests (id, order_id, customer_id, customer_email, customer_name, type, reason, description,
         status, track_token, pickup_address, refund_method, refund_payout_enc, delivered_at, deadline_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'submitted',$9,$10::jsonb,$11,$12,$13,$14,$15,$15)`,
      [
        id, fresh.id, input.customer.id, fresh.customerEmail, input.customer.name, input.type, input.reason,
        input.description, newTrackToken(), JSON.stringify(input.pickupAddress), input.refundMethod,
        input.refundPayoutEnc ?? null, elig.deliveredAt, elig.deadlineAt, now.toISOString(),
      ]
    );
    for (const line of lines) {
      await tx.query(
        "INSERT INTO return_request_items (request_id, product_id, name, quantity, unit_price_paise) VALUES ($1,$2,$3,$4,$5)",
        [id, line.productId, line.name, line.quantity, line.unitPricePaise]
      );
    }
    for (const file of input.evidence) {
      await tx.query(
        "INSERT INTO return_evidence (request_id, kind, filename, mime, size, data) VALUES ($1,$2,$3,$4,$5,$6)",
        [id, file.kind, file.filename, file.mime, file.data.length, file.data]
      );
    }
    await tx.query(
      "INSERT INTO return_status_history (request_id, from_status, to_status, actor, note) VALUES ($1,NULL,'submitted','customer',$2)",
      [id, `${input.type === "return" ? "Return" : "Replacement"} requested`]
    );
  });

  const created = await getReturnRequest(id);
  if (!created) throw new Error("Return request vanished after insert");
  return created;
}

// ---- read -----------------------------------------------------------------

export async function getReturnRequest(id: string): Promise<ReturnRequest | undefined> {
  const db = await getDb();
  const res = await db.query<RequestRow>("SELECT * FROM return_requests WHERE id = $1", [id]);
  return (await hydrateRequests(db, res.rows))[0];
}

export async function listReturnsForOrder(orderId: string): Promise<ReturnRequest[]> {
  const db = await getDb();
  const res = await db.query<RequestRow>("SELECT * FROM return_requests WHERE order_id = $1 ORDER BY created_at DESC", [orderId]);
  return hydrateRequests(db, res.rows);
}

export async function listReturnsForCustomer(customer: { id: number; email: string; emailVerified: boolean }): Promise<ReturnRequest[]> {
  const db = await getDb();
  const res = await db.query<RequestRow>(
    `SELECT * FROM return_requests
      WHERE customer_id = $1 OR ($2::boolean AND lower(customer_email) = lower($3))
      ORDER BY created_at DESC`,
    [customer.id, customer.emailVerified, customer.email]
  );
  return hydrateRequests(db, res.rows);
}

export type ReturnFilter = { group?: string; q?: string };

/** Status groups used by the admin filter tabs. */
export const STATUS_GROUPS: Record<string, readonly ReturnStatus[]> = {
  pending: ["submitted", "under_review"],
  approved: ["approved"],
  rejected: ["rejected"],
  pickup: ["pickup_scheduled", "picked_up", "pickup_failed", "inspection", "inspection_failed"],
  refund: ["refund_initiated", "refund_failed"],
  replacement: ["replacement_processing", "replacement_unavailable"],
  completed: ["completed"],
  cancelled: ["cancelled"],
};

export async function listAllReturns(filter: ReturnFilter = {}): Promise<ReturnRequest[]> {
  const db = await getDb();
  const where: string[] = [];
  const params: unknown[] = [];
  const statuses = filter.group ? STATUS_GROUPS[filter.group] : undefined;
  if (statuses) {
    params.push([...statuses]);
    where.push(`r.status = ANY($${params.length})`);
  }
  const q = filter.q?.trim();
  if (q) {
    params.push(`%${q.toLowerCase().replace(/[%_\\]/g, (c) => `\\${c}`)}%`);
    const n = params.length;
    where.push(`(lower(r.id) LIKE $${n} OR lower(r.customer_email) LIKE $${n} OR lower(r.customer_name) LIKE $${n}
      OR lower(r.order_id) LIKE $${n} OR ('sk-' || o.order_number::text) LIKE $${n} OR o.order_number::text LIKE $${n}
      OR EXISTS (SELECT 1 FROM return_request_items i WHERE i.request_id = r.id AND lower(i.name) LIKE $${n}))`);
  }
  const res = await db.query<RequestRow>(
    `SELECT r.* FROM return_requests r JOIN orders o ON o.id = r.order_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY r.created_at DESC LIMIT 300`,
    params
  );
  return hydrateRequests(db, res.rows);
}

export type ReturnSummary = {
  pending: number; approved: number; inProgress: number; rejected: number; completedRefunds: number; replacements: number;
};

export async function getReturnSummary(): Promise<ReturnSummary> {
  const db = await getDb();
  const res = await db.query<{ status: ReturnStatus; type: RequestType; n: number }>(
    "SELECT status, type, COUNT(*)::int AS n FROM return_requests GROUP BY status, type"
  );
  const s: ReturnSummary = { pending: 0, approved: 0, inProgress: 0, rejected: 0, completedRefunds: 0, replacements: 0 };
  for (const r of res.rows) {
    const n = num(r.n);
    if (STATUS_GROUPS.pending.includes(r.status)) s.pending += n;
    else if (r.status === "approved") s.approved += n;
    else if (r.status === "rejected") s.rejected += n;
    else if (r.status === "completed" && r.type === "return") s.completedRefunds += n;
    else if (r.status === "completed" && r.type === "replacement") s.replacements += n;
    else if (r.status !== "cancelled") s.inProgress += n;
    if (r.type === "replacement" && ["replacement_processing", "replacement_unavailable"].includes(r.status)) s.replacements += n;
  }
  return s;
}

/** The audit trail. Customers get `includeInternal = false` (the default); staff pass true. */
export async function getStatusHistory(id: string, includeInternal = false): Promise<StatusHistoryEntry[]> {
  const db = await getDb();
  const res = await db.query<{ id: number; from_status: ReturnStatus | null; to_status: ReturnStatus; actor: StatusHistoryEntry["actor"]; note: string | null; internal: boolean; created_at: Date | string }>(
    "SELECT * FROM return_status_history WHERE request_id = $1 AND ($2::boolean OR NOT internal) ORDER BY id",
    [id, includeInternal]
  );
  return res.rows.map((r) => ({
    id: num(r.id),
    ...(r.from_status ? { fromStatus: r.from_status } : {}),
    toStatus: r.to_status,
    actor: r.actor,
    ...(r.note ? { note: r.note } : {}),
    ...(r.internal ? { internal: true } : {}),
    createdAt: iso(r.created_at),
  }));
}

export async function listEvidence(id: string): Promise<EvidenceMeta[]> {
  const db = await getDb();
  const res = await db.query<{ id: number; kind: "image" | "video"; filename: string; mime: string; size: number }>(
    "SELECT id, kind, filename, mime, size FROM return_evidence WHERE request_id = $1 ORDER BY id",
    [id]
  );
  return res.rows.map((r) => ({ id: num(r.id), kind: r.kind, filename: r.filename, mime: r.mime, size: num(r.size) }));
}

export async function getEvidenceFile(requestId: string, evidenceId: number): Promise<{ mime: string; filename: string; data: Buffer } | undefined> {
  const db = await getDb();
  const res = await db.query<{ mime: string; filename: string; data: unknown }>(
    "SELECT mime, filename, data FROM return_evidence WHERE request_id = $1 AND id = $2",
    [requestId, evidenceId]
  );
  const row = res.rows[0];
  if (!row) return undefined;
  return { mime: row.mime, filename: row.filename, data: bytes(row.data) };
}

export async function getEncryptedPayout(id: string): Promise<string | null> {
  const db = await getDb();
  const res = await db.query<{ refund_payout_enc: string | null }>("SELECT refund_payout_enc FROM return_requests WHERE id = $1", [id]);
  return res.rows[0]?.refund_payout_enc ?? null;
}

// ---- status changes -------------------------------------------------------

export type TransitionPatch = {
  rejectionReason?: string;
  adminNote?: string;
  pickupScheduledFor?: string;
  pickupCourier?: string;
  pickupTracking?: string;
  clearPayout?: boolean;
};

/**
 * Moves a request to a new status — only along an allowed edge, only if it
 * is still in the status the caller saw (compare-and-swap), and always with
 * a history row, atomically. `tx` lets callers fold this into a larger
 * transaction (e.g. completing a refund).
 */
export async function transitionStatus(
  requestId: string,
  from: ReturnStatus,
  to: ReturnStatus,
  actor: StatusHistoryEntry["actor"],
  note?: string,
  patch: TransitionPatch = {},
  tx?: Db
): Promise<void> {
  if (!canTransition(from, to)) throw new ReturnError("invalid_transition", 409, `${from} → ${to}`);
  const run = async (db: Db) => {
    const res = await db.query(
      `UPDATE return_requests SET
          status = $3,
          rejection_reason = COALESCE($4, rejection_reason),
          admin_note = COALESCE($5, admin_note),
          pickup_scheduled_for = COALESCE($6::timestamptz, pickup_scheduled_for),
          pickup_courier = COALESCE($7, pickup_courier),
          pickup_tracking = COALESCE($8, pickup_tracking),
          refund_payout_enc = CASE WHEN $9::boolean THEN NULL ELSE refund_payout_enc END,
          updated_at = now()
        WHERE id = $1 AND status = $2`,
      [
        requestId, from, to, patch.rejectionReason ?? null, patch.adminNote ?? null,
        patch.pickupScheduledFor ?? null, patch.pickupCourier ?? null, patch.pickupTracking ?? null,
        patch.clearPayout === true,
      ]
    );
    if (res.rowCount === 0) throw new ReturnError("stale_status", 409);
    await db.query(
      "INSERT INTO return_status_history (request_id, from_status, to_status, actor, note) VALUES ($1,$2,$3,$4,$5)",
      [requestId, from, to, actor, note ?? null]
    );
  };
  if (tx) await run(tx);
  else await (await getDb()).transaction(run);
}

/** Admin note that doesn't change status. */
export async function addHistoryNote(requestId: string, status: ReturnStatus, actor: StatusHistoryEntry["actor"], note: string, internal = true): Promise<void> {
  const db = await getDb();
  await db.query(
    "INSERT INTO return_status_history (request_id, from_status, to_status, actor, note, internal) VALUES ($1,$2,$2,$3,$4,$5)",
    [requestId, status, actor, note, internal]
  );
}

export { isSellerFault, isUniqueViolation };
