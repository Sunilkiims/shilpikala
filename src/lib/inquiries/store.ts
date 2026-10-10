import { getDb } from "@/lib/db";
import { iso, num } from "@/lib/db/rows";

export type InquiryKind = "contact" | "custom-art";
export const INQUIRY_STATUSES = ["new", "replied", "closed"] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

export type Inquiry = {
  id: number;
  kind: InquiryKind;
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  details?: Record<string, string>;
  status: InquiryStatus;
  createdAt: string;
};

type Row = {
  id: number; kind: InquiryKind; name: string; email: string; phone: string | null;
  subject: string | null; message: string; details: Record<string, string> | null;
  status: InquiryStatus; created_at: Date | string;
};

const toInquiry = (r: Row): Inquiry => ({
  id: num(r.id),
  kind: r.kind,
  name: r.name,
  email: r.email,
  ...(r.phone ? { phone: r.phone } : {}),
  ...(r.subject ? { subject: r.subject } : {}),
  message: r.message,
  ...(r.details ? { details: r.details } : {}),
  status: r.status,
  createdAt: iso(r.created_at),
});

export type NewInquiry = Omit<Inquiry, "id" | "status" | "createdAt">;

export async function createInquiry(input: NewInquiry): Promise<Inquiry> {
  const db = await getDb();
  const res = await db.query<Row>(
    `INSERT INTO inquiries (kind, name, email, phone, subject, message, details)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING *`,
    [input.kind, input.name, input.email, input.phone ?? null, input.subject ?? null,
      input.message, input.details ? JSON.stringify(input.details) : null]
  );
  return toInquiry(res.rows[0]);
}

export async function listInquiries(): Promise<Inquiry[]> {
  const db = await getDb();
  const res = await db.query<Row>("SELECT * FROM inquiries ORDER BY created_at DESC, id DESC");
  return res.rows.map(toInquiry);
}

export async function updateInquiryStatus(id: number, status: InquiryStatus): Promise<Inquiry | undefined> {
  const db = await getDb();
  const res = await db.query<Row>("UPDATE inquiries SET status = $2 WHERE id = $1 RETURNING *", [id, status]);
  return res.rows[0] ? toInquiry(res.rows[0]) : undefined;
}
