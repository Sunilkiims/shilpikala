import { NextResponse } from "next/server";
import { refreshAfter } from "@/lib/cache/revalidate";
import { discountToInput } from "@/lib/offers/money";
import { deleteOffer, getOffer, setOfferFlags, updateOffer } from "@/lib/offers/store";
import { parseOfferInput } from "@/lib/offers/validate";

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
  const parsed = await parseOfferInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error, field: parsed.field, products: parsed.products }, { status: 400 });
  const offer = await updateOffer(id, parsed.value);
  return offer ? NextResponse.json({ offer }) : NextResponse.json({ error: "not_found" }, { status: 404 });
}

/** Quick actions from the list: { enabled } and/or { published }. */
async function patchHandler(request: Request, ctx: Ctx) {
  const id = await parseId(ctx);
  if (id === null) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const flags: { enabled?: boolean; published?: boolean } = {};
  for (const k of ["enabled", "published"] as const) {
    if (body[k] !== undefined) {
      if (typeof body[k] !== "boolean") return NextResponse.json({ error: "invalid_body" }, { status: 400 });
      flags[k] = body[k] as boolean;
    }
  }
  if (flags.enabled === undefined && flags.published === undefined) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  if (flags.published || flags.enabled) {
    // Turning an offer on re-checks it against today's prices and dates (a product's price may have changed since it was saved).
    const cur = await getOffer(id);
    if (!cur) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const parsed = await parseOfferInput({
      ...cur,
      discountValue: discountToInput(cur.discountValue),
      published: flags.published ?? cur.published,
      enabled: flags.enabled ?? cur.enabled,
    });
    if (!parsed.ok) return NextResponse.json({ error: parsed.error, field: parsed.field, products: parsed.products }, { status: 400 });
  }
  const offer = await setOfferFlags(id, flags);
  return offer ? NextResponse.json({ offer }) : NextResponse.json({ error: "not_found" }, { status: 404 });
}

async function deleteHandler(_request: Request, ctx: Ctx) {
  const id = await parseId(ctx);
  if (id === null) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  return (await deleteOffer(id)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "not_found" }, { status: 404 });
}

export const PUT = refreshAfter(putHandler);
export const PATCH = refreshAfter(patchHandler);
export const DELETE = refreshAfter(deleteHandler);
