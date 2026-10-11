import { NextResponse } from "next/server";
import { readJson } from "@/lib/auth/guard";
import { returnErrorResponse } from "@/lib/returns/http";
import { ADMIN_ACTIONS, executeAdminAction, type AdminActionName } from "@/lib/returns/workflow";

type RouteParams = { params: Promise<{ id: string }> };

/** Body: { action, ...fields }. Admin-only — the proxy guards /api/admin. */
export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = await readJson(request);
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const action = body.action;
  if (typeof action !== "string" || !ADMIN_ACTIONS.includes(action as AdminActionName)) {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }
  try {
    const updated = await executeAdminAction(id, action as AdminActionName, body);
    return NextResponse.json({ status: updated.status });
  } catch (error) {
    return returnErrorResponse(error);
  }
}
