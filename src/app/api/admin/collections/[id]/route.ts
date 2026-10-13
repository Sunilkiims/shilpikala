import { NextResponse } from "next/server";
import { refreshAfter } from "@/lib/cache/revalidate";
import { deleteCollection, saveCollection } from "@/lib/ads/store";
import { parseCollection } from "@/lib/ads/collectionInput";

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
  const parsed = await parseCollection(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const collection = await saveCollection({ id, ...parsed.value });
  return collection ? NextResponse.json({ collection }) : NextResponse.json({ error: "not_found" }, { status: 404 });
}

async function deleteHandler(_request: Request, ctx: Ctx) {
  const id = await parseId(ctx);
  if (id === null) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  return (await deleteCollection(id)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "not_found" }, { status: 404 });
}

export const PUT = refreshAfter(putHandler);
export const DELETE = refreshAfter(deleteHandler);
