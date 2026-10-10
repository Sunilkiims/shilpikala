import { NextResponse } from "next/server";
import { buildInvoicePdf, pdfResponse } from "@/lib/invoices/service";
import { getOrderByReference } from "@/lib/orders/store";

type RouteParams = { params: Promise<{ id: string }> };

/** Admin-only (the proxy guards /api/admin/*). */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const order = await getOrderByReference(id);
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { pdf, filename } = await buildInvoicePdf(order);
  return pdfResponse(pdf, filename);
}
