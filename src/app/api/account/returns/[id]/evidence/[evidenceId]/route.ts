import { NextResponse } from "next/server";
import { getCustomerFromRequest } from "@/lib/auth/session";
import { evidenceResponse } from "@/lib/returns/http";
import { getEvidenceFile, getReturnRequest } from "@/lib/returns/store";
import { customerOwnsRequest } from "@/lib/returns/workflow";

type RouteParams = { params: Promise<{ id: string; evidenceId: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const customer = await getCustomerFromRequest(request);
  if (!customer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, evidenceId } = await params;
  const found = await getReturnRequest(id);
  const n = Number(evidenceId);
  if (!found || !customerOwnsRequest(customer, found) || !Number.isInteger(n)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const file = await getEvidenceFile(id, n);
  return file ? evidenceResponse(file) : NextResponse.json({ error: "not_found" }, { status: 404 });
}
