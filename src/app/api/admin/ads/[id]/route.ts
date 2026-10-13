import { NextResponse } from "next/server";
import { refreshAfter } from "@/lib/cache/revalidate";
import { deleteAd, getAd, moveAd, setAdFlags, updateAd } from "@/lib/ads/store";
import { parseAdInput } from "@/lib/ads/validate";

type Ctx = { params: Promise<{ id: string }> };
const parseId = async (ctx: Ctx) => {
  const n = Number((await ctx.params).id);
  return Number.isInteger(n) && n > 0 ? n : null;
};

async function putHandler(request: Request, ctx: Ctx) {
  const id = await parseId(ctx);
  if (id === null) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const parsed = await parseAdInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error, field: parsed.field }, { status: 400 });
  const ad = await updateAd(id, parsed.value);
  return ad ? NextResponse.json({ ad }) : NextResponse.json({ error: "not_found" }, { status: 404 });
}

/** Quick actions from the list: { enabled }, { published }, or { move: "up" | "down" }. */
async function patchHandler(request: Request, ctx: Ctx) {
  const id = await parseId(ctx);
  if (id === null) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  if (body.move !== undefined) {
    if (body.move !== "up" && body.move !== "down") return NextResponse.json({ error: "invalid_move" }, { status: 400 });
    return (await moveAd(id, body.move)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const flags: { enabled?: boolean; published?: boolean } = {};
  if (body.enabled !== undefined) { if (typeof body.enabled !== "boolean") return NextResponse.json({ error: "invalid_body" }, { status: 400 }); flags.enabled = body.enabled; }
  if (body.published !== undefined) { if (typeof body.published !== "boolean") return NextResponse.json({ error: "invalid_body" }, { status: 400 }); flags.published = body.published; }
  if (flags.enabled === undefined && flags.published === undefined) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  if (flags.published) {
    // Publishing needs the same checks as a full save (e.g. artwork present).
    const cur = await getAd(id);
    if (!cur) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (cur.type !== "carousel" && cur.desktopMediaId === undefined && cur.mobileMediaId === undefined) {
      return NextResponse.json({ error: "media_required" }, { status: 400 });
    }
  }
  const ad = await setAdFlags(id, flags);
  return ad ? NextResponse.json({ ad }) : NextResponse.json({ error: "not_found" }, { status: 404 });
}

async function deleteHandler(_request: Request, ctx: Ctx) {
  const id = await parseId(ctx);
  if (id === null) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  return (await deleteAd(id)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "not_found" }, { status: 404 });
}

export const PUT = refreshAfter(putHandler);
export const PATCH = refreshAfter(patchHandler);
export const DELETE = refreshAfter(deleteHandler);
