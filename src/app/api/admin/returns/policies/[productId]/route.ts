import { NextResponse } from "next/server";
import { readJson } from "@/lib/auth/guard";
import { setProductPolicy } from "@/lib/returns/store";

type RouteParams = { params: Promise<{ productId: string }> };

/** Sets whether a product can be returned and/or replaced. Admin-only. */
export async function PUT(request: Request, { params }: RouteParams) {
  const { productId } = await params;
  const id = Number(productId);
  const body = await readJson(request);
  if (!Number.isInteger(id) || !body || typeof body.returnable !== "boolean" || typeof body.replaceable !== "boolean") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 300) : "";
  const ok = await setProductPolicy(id, { returnable: body.returnable, replaceable: body.replaceable, ...(note ? { note } : {}) });
  return ok ? NextResponse.json({ saved: true }) : NextResponse.json({ error: "not_found" }, { status: 404 });
}
