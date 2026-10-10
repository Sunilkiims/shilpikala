import { NextResponse } from "next/server";
import { readJson, limitAttempts } from "@/lib/auth/guard";
import { buildInvoicePdf, pdfResponse } from "@/lib/invoices/service";
import { getOrderByReference } from "@/lib/orders/store";

/**
 * Guest invoice download: needs BOTH the order reference and the email
 * the order was placed with. Wrong combinations all answer the same 404,
 * and every attempt is rate limited.
 */
export async function POST(request: Request) {
  const limited = limitAttempts(request, "track-invoice", 15, 15 * 60 * 1000);
  if (limited) return limited;

  const body = await readJson(request);
  const reference = typeof body?.orderId === "string" ? body.orderId.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!reference || !email) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const order = await getOrderByReference(reference);
  if (!order || order.customerEmail.toLowerCase() !== email.toLowerCase()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const { pdf, filename } = await buildInvoicePdf(order);
  return pdfResponse(pdf, filename);
}
