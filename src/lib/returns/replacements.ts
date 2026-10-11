import { getDb } from "@/lib/db";
import type { Db } from "@/lib/db/client";
import { iso, isUniqueViolation, num } from "@/lib/db/rows";
import { getReturnRequest, newReplacementTracking, newShipmentId, transitionStatus } from "@/lib/returns/store";
import { ReturnError, type ReplacementShipment, type ReturnRequest, type ReturnStatus } from "@/lib/returns/types";

type ShipmentRow = {
  id: string; request_id: string; order_id: string; status: ReplacementShipment["status"]; tracking_number: string;
  carrier: string | null; carrier_tracking: string | null; items: ReplacementShipment["items"];
  dispatched_at: Date | string | null; delivered_at: Date | string | null; created_at: Date | string;
};

const toShipment = (r: ShipmentRow): ReplacementShipment => ({
  id: r.id, requestId: r.request_id, orderId: r.order_id, status: r.status, trackingNumber: r.tracking_number,
  ...(r.carrier ? { carrier: r.carrier } : {}),
  ...(r.carrier_tracking ? { carrierTracking: r.carrier_tracking } : {}),
  items: r.items,
  ...(r.dispatched_at ? { dispatchedAt: iso(r.dispatched_at) } : {}),
  ...(r.delivered_at ? { deliveredAt: iso(r.delivered_at) } : {}),
  createdAt: iso(r.created_at),
});

export async function getShipmentForRequest(requestId: string): Promise<ReplacementShipment | undefined> {
  const db = await getDb();
  const res = await db.query<ShipmentRow>("SELECT * FROM replacement_shipments WHERE request_id = $1", [requestId]);
  return res.rows[0] ? toShipment(res.rows[0]) : undefined;
}

class Shortage extends Error {
  constructor(public products: string[]) {
    super("shortage");
  }
}

/**
 * Takes the replacement units out of stock. Each product is decremented with a
 * single guarded UPDATE (`stock >= qty`), so two requests for the last unit
 * cannot both succeed — no overselling. Products that don't track stock
 * (made to order) are available while marked in stock.
 */
async function reserveStock(tx: Db, items: ReturnRequest["items"]): Promise<void> {
  const short: string[] = [];
  for (const item of items) {
    const took = await tx.query(
      `UPDATE products
          SET stock_quantity = stock_quantity - $2, in_stock = (stock_quantity - $2) > 0
        WHERE id = $1 AND stock_quantity IS NOT NULL AND stock_quantity >= $2
        RETURNING id`,
      [item.productId, item.quantity]
    );
    if (took.rowCount > 0) continue;
    const p = await tx.query<{ in_stock: boolean; stock_quantity: number | null }>(
      "SELECT in_stock, stock_quantity FROM products WHERE id = $1",
      [item.productId]
    );
    const row = p.rows[0];
    if (!(row && row.stock_quantity === null && row.in_stock)) short.push(item.name);
  }
  if (short.length > 0) throw new Shortage(short);
}

export type ReplacementOutcome =
  | { ok: true; shipment: ReplacementShipment; request: ReturnRequest }
  | { ok: false; unavailable: string[]; request: ReturnRequest };

const REPLACEABLE_FROM: readonly ReturnStatus[] = ["inspection", "inspection_failed", "replacement_unavailable"];

/**
 * Moves a request into "replacement_processing" and reserves stock + creates the
 * shipment record in ONE transaction. If any item is short, everything rolls
 * back (no partial reservation) and the request is parked at
 * "replacement_unavailable" for the admin to choose an alternative.
 */
export async function startReplacement(requestId: string, actor: "admin" | "system", note?: string): Promise<ReplacementOutcome> {
  const db = await getDb();
  const before = await getReturnRequest(requestId);
  if (!before) throw new ReturnError("not_found", 404);
  if (before.type !== "replacement") throw new ReturnError("not_a_replacement", 409);
  if (!REPLACEABLE_FROM.includes(before.status)) throw new ReturnError("invalid_transition", 409, `${before.status} → replacement_processing`);

  try {
    await db.transaction(async (tx) => {
      const cur = await tx.query<{ status: ReturnStatus }>("SELECT status FROM return_requests WHERE id = $1 FOR UPDATE", [requestId]);
      const from = cur.rows[0]?.status;
      if (!from || !REPLACEABLE_FROM.includes(from)) throw new ReturnError("stale_status", 409);
      await transitionStatus(requestId, from, "replacement_processing", actor, note ?? "Replacement approved", {}, tx);
      await reserveStock(tx, before.items);
      try {
        await tx.query(
          "INSERT INTO replacement_shipments (id, request_id, order_id, status, tracking_number, items) VALUES ($1,$2,$3,'processing',$4,$5::jsonb)",
          [
            newShipmentId(), requestId, before.orderId, newReplacementTracking(),
            JSON.stringify(before.items.map((i) => ({ productId: i.productId, name: i.name, quantity: i.quantity }))),
          ]
        );
      } catch (error) {
        if (isUniqueViolation(error)) throw new ReturnError("replacement_already_created", 409);
        throw error;
      }
    });
  } catch (error) {
    if (!(error instanceof Shortage)) throw error;
    await db.transaction(async (tx) => {
      const cur = await tx.query<{ status: ReturnStatus }>("SELECT status FROM return_requests WHERE id = $1 FOR UPDATE", [requestId]);
      const from = cur.rows[0]?.status;
      if (!from || !REPLACEABLE_FROM.includes(from)) throw new ReturnError("stale_status", 409);
      await transitionStatus(requestId, from, "replacement_processing", actor, note ?? "Replacement approved", {}, tx);
      await transitionStatus(
        requestId, "replacement_processing", "replacement_unavailable", "system",
        `Not enough stock for: ${error.products.join(", ")}`, {}, tx
      );
    });
    const request = await getReturnRequest(requestId);
    return { ok: false, unavailable: error.products, request: request as ReturnRequest };
  }

  const [request, shipment] = await Promise.all([getReturnRequest(requestId), getShipmentForRequest(requestId)]);
  return { ok: true, shipment: shipment as ReplacementShipment, request: request as ReturnRequest };
}

export async function dispatchReplacement(
  requestId: string,
  info: { carrier?: string; carrierTracking?: string }
): Promise<{ shipment: ReplacementShipment; request: ReturnRequest }> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const cur = await tx.query<{ status: ReturnStatus }>("SELECT status FROM return_requests WHERE id = $1 FOR UPDATE", [requestId]);
    if (cur.rows[0]?.status !== "replacement_processing") throw new ReturnError("invalid_transition", 409);
    const res = await tx.query(
      `UPDATE replacement_shipments SET status='dispatched', carrier=$2, carrier_tracking=$3, dispatched_at=now()
        WHERE request_id=$1 AND status='processing' RETURNING id`,
      [requestId, info.carrier ?? null, info.carrierTracking ?? null]
    );
    if (res.rowCount === 0) throw new ReturnError("shipment_not_ready", 409);
    await tx.query(
      "INSERT INTO return_status_history (request_id, from_status, to_status, actor, note) VALUES ($1,'replacement_processing','replacement_processing','admin','Replacement dispatched')",
      [requestId]
    );
  });
  const [request, shipment] = await Promise.all([getReturnRequest(requestId), getShipmentForRequest(requestId)]);
  return { shipment: shipment as ReplacementShipment, request: request as ReturnRequest };
}

export async function markReplacementDelivered(requestId: string): Promise<{ shipment: ReplacementShipment; request: ReturnRequest }> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const cur = await tx.query<{ status: ReturnStatus }>("SELECT status FROM return_requests WHERE id = $1 FOR UPDATE", [requestId]);
    if (cur.rows[0]?.status !== "replacement_processing") throw new ReturnError("invalid_transition", 409);
    const res = await tx.query(
      "UPDATE replacement_shipments SET status='delivered', delivered_at=now() WHERE request_id=$1 AND status='dispatched' RETURNING id",
      [requestId]
    );
    if (res.rowCount === 0) throw new ReturnError("shipment_not_dispatched", 409);
    await transitionStatus(requestId, "replacement_processing", "completed", "admin", "Replacement delivered", {}, tx);
  });
  const [request, shipment] = await Promise.all([getReturnRequest(requestId), getShipmentForRequest(requestId)]);
  return { shipment: shipment as ReplacementShipment, request: request as ReturnRequest };
}

export { num };
