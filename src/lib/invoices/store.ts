import { getDb } from "@/lib/db";
import { iso } from "@/lib/db/rows";
import { getBusinessProfile } from "./business";

export type InvoiceRecord = {
  orderId: string;
  invoiceNumber: string;
  fiscalYear: string;
  issuedAt: string;
};

/** Indian financial year (1 April – 31 March), e.g. "2026-27". */
export function fiscalYearFor(date: Date): string {
  // Use IST so an order at 00:30 IST on 1 April lands in the new year.
  const ist = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);
  const year = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export function formatInvoiceNumber(prefix: string, fiscalYear: string, sequence: number): string {
  return `${prefix}/${fiscalYear}/${String(sequence).padStart(5, "0")}`;
}

type InvoiceRow = { order_id: string; invoice_number: string; fiscal_year: string; issued_at: unknown };
const toRecord = (r: InvoiceRow): InvoiceRecord => ({
  orderId: r.order_id,
  invoiceNumber: r.invoice_number,
  fiscalYear: r.fiscal_year,
  issuedAt: iso(r.issued_at),
});

export async function getInvoiceForOrder(orderId: string): Promise<InvoiceRecord | undefined> {
  const db = await getDb();
  const res = await db.query<InvoiceRow>(
    "SELECT order_id, invoice_number, fiscal_year, issued_at FROM invoices WHERE order_id = $1",
    [orderId]
  );
  return res.rows[0] ? toRecord(res.rows[0]) : undefined;
}

/**
 * Returns the order's invoice, issuing it on first call. Numbers are
 * sequential and gap-free per financial year: the counter bump and the
 * invoice insert share one transaction, serialised per order (row lock)
 * and across orders (counter row lock), so a failure rolls the number
 * back instead of burning it.
 */
export async function ensureInvoice(orderId: string, now: Date = new Date()): Promise<InvoiceRecord> {
  const existing = await getInvoiceForOrder(orderId);
  if (existing) return existing;

  const prefix = getBusinessProfile().invoicePrefix;
  const db = await getDb();
  return db.transaction(async (tx) => {
    const lock = await tx.query("SELECT id FROM orders WHERE id = $1 FOR UPDATE", [orderId]);
    if (lock.rows.length === 0) throw new Error(`Cannot invoice unknown order ${orderId}`);

    const again = await tx.query<InvoiceRow>(
      "SELECT order_id, invoice_number, fiscal_year, issued_at FROM invoices WHERE order_id = $1",
      [orderId]
    );
    if (again.rows[0]) return toRecord(again.rows[0]);

    const fiscalYear = fiscalYearFor(now);
    const counter = await tx.query<{ last: number }>(
      `INSERT INTO invoice_counters (fiscal_year, last) VALUES ($1, 1)
       ON CONFLICT (fiscal_year) DO UPDATE SET last = invoice_counters.last + 1
       RETURNING last`,
      [fiscalYear]
    );
    const invoiceNumber = formatInvoiceNumber(prefix, fiscalYear, Number(counter.rows[0].last));
    const inserted = await tx.query<InvoiceRow>(
      `INSERT INTO invoices (order_id, invoice_number, fiscal_year, issued_at)
       VALUES ($1, $2, $3, $4)
       RETURNING order_id, invoice_number, fiscal_year, issued_at`,
      [orderId, invoiceNumber, fiscalYear, now.toISOString()]
    );
    return toRecord(inserted.rows[0]);
  });
}
