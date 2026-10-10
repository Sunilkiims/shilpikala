import { getBusinessProfile } from "./business";
import { invoiceFileName, renderInvoicePdf } from "./pdf";
import { ensureInvoice } from "./store";
import type { StoredOrder } from "@/lib/orders/types";

/** Renders the order's invoice PDF on demand from the stored order (issuing the number on first use). */
export async function buildInvoicePdf(order: StoredOrder) {
  const invoice = await ensureInvoice(order.id);
  const pdf = await renderInvoicePdf(order, invoice, getBusinessProfile());
  return { invoice, pdf, filename: invoiceFileName(invoice) };
}

/** A customer may open an order they placed while signed in, or one placed with their VERIFIED email. */
export function customerOwnsOrder(
  customer: { id: number; email: string; emailVerified: boolean },
  order: StoredOrder
): boolean {
  if (order.customerId === customer.id) return true;
  return customer.emailVerified && order.customerEmail.toLowerCase() === customer.email.toLowerCase();
}

export function pdfResponse(pdf: Buffer, filename: string): Response {
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdf.length),
      // Personal data: never cached by browsers or shared caches.
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
