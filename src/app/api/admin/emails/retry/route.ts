import { NextResponse } from "next/server";
import { readJson } from "@/lib/auth/guard";
import { retryOrderEmails } from "@/lib/orders/orderEmails";

/** Admin-only (guarded by the proxy). Body: { orderId?: string } — omit to sweep recent orders. */
export async function POST(request: Request) {
  const body = await readJson(request);
  const orderId = typeof body?.orderId === "string" && body.orderId ? body.orderId : undefined;
  const result = await retryOrderEmails(orderId);
  if (orderId && result.orders === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(result);
}
