import { NextResponse } from "next/server";
import { getCustomerFromRequest } from "@/lib/auth/session";
import { buildInvoicePdf, customerOwnsOrder, pdfResponse } from "@/lib/invoices/service";
import { getOrderByReference } from "@/lib/orders/store";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * A signed-in customer downloads the invoice for one of THEIR orders.
 * Someone else's order answers 404 — the same as a missing one — so
 * order references can't be probed.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const customer = await getCustomerFromRequest(request);
  if (!customer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const order = await getOrderByReference(id);
  if (!order || !customerOwnsOrder(customer, order)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const { pdf, filename } = await buildInvoicePdf(order);
  return pdfResponse(pdf, filename);
}
