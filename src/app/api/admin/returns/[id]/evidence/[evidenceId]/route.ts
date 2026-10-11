import { NextResponse } from "next/server";
import { evidenceResponse } from "@/lib/returns/http";
import { getEvidenceFile } from "@/lib/returns/store";

type RouteParams = { params: Promise<{ id: string; evidenceId: string }> };

/** Admin-only (the proxy guards /api/admin). */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id, evidenceId } = await params;
  const n = Number(evidenceId);
  if (!Number.isInteger(n)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const file = await getEvidenceFile(id, n);
  return file ? evidenceResponse(file) : NextResponse.json({ error: "not_found" }, { status: 404 });
}
