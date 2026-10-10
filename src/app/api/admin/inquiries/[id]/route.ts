import { NextResponse } from "next/server";
import { readJson } from "@/lib/auth/guard";
import { INQUIRY_STATUSES, updateInquiryStatus, type InquiryStatus } from "@/lib/inquiries/store";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const body = await readJson(request);
  const status = body?.status;
  if (typeof status !== "string" || !INQUIRY_STATUSES.includes(status as InquiryStatus)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }
  const updated = await updateInquiryStatus(id, status as InquiryStatus);
  if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ inquiry: updated });
}
