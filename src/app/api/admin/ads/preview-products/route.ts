import { NextResponse } from "next/server";
import { pickCarouselProducts, toCard } from "@/lib/ads/public";
import { LIMITS, SOURCE_TYPES, type SourceType } from "@/lib/ads/types";

/** Which products a carousel configuration would show right now (admin preview uses the live selection logic). */
export async function POST(request: Request) {
  let b: Record<string, unknown>;
  try { b = (await request.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const sourceType = b?.sourceType as SourceType;
  if (!SOURCE_TYPES.includes(sourceType)) return NextResponse.json({ error: "invalid_source" }, { status: 400 });
  const ids = Array.isArray(b.productIds) ? b.productIds.filter((x): x is number => Number.isInteger(x)).slice(0, LIMITS.maxProducts) : [];
  const maxItems = Math.min(Math.max(Number(b.maxItems) || 12, 1), LIMITS.maxItems);
  const ref = Number.isInteger(b.sourceRef) ? (b.sourceRef as number) : undefined;
  const products = await pickCarouselProducts({ sourceType, sourceRef: ref, productIds: ids, maxItems });
  return NextResponse.json({ products: products.map(toCard) });
}
