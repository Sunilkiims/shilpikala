import { NextResponse } from "next/server";
import { readJson } from "@/lib/auth/guard";
import { sendOrderStatusEmail } from "@/lib/orders/orderEmails";
import { getOrderById, updateOrderFulfilment } from "@/lib/orders/store";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/orders/types";

type RouteParams = { params: Promise<{ id: string }> };

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = await readJson(request);
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  let status: OrderStatus | undefined;
  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !ORDER_STATUSES.includes(body.status as OrderStatus)) {
      return NextResponse.json({ error: "invalid_status" }, { status: 400 });
    }
    status = body.status as OrderStatus;
  }
  const trackingNumber = clean(body.trackingNumber, 100);
  const carrier = clean(body.carrier, 60);

  const before = await getOrderById(id);
  if (!before) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const updated = await updateOrderFulfilment(id, {
    status,
    trackingNumber: trackingNumber === undefined ? undefined : trackingNumber || null,
    carrier: carrier === undefined ? undefined : carrier || null,
  });

  // Tell the customer on each transition into a customer-facing status.
  // The outbox sends each status email at most once per order.
  if (updated && status && status !== before.status && status !== "paid") {
    await sendOrderStatusEmail(updated, status);
  }
  return NextResponse.json({ order: updated });
}
