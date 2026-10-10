import { NextResponse } from "next/server";
import { resolveUnreconciledPayment } from "@/lib/orders/store";

type RouteParams = { params: Promise<{ id: string }> };

/** Marks a payment as manually reconciled (e.g. refunded or matched by hand in Razorpay). */
export async function POST(_request: Request, { params }: RouteParams) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  if (!(await resolveUnreconciledPayment(id))) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
