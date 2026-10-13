import { NextResponse } from "next/server";
import { buildOfferPreview } from "@/lib/offers/preview";
import { DISCOUNT_TYPES, type DiscountType } from "@/lib/offers/money";
import { LIMITS, OFFER_SCOPES, type OfferScope } from "@/lib/offers/types";
import { parseDiscountValue } from "@/lib/offers/validate";

/**
 * Prices a draft offer for the admin form before it is saved. The browser sends what the admin
 * typed; every number in the response is computed here, from the catalogue's real current prices.
 */
export async function POST(request: Request) {
  let b: Record<string, unknown>;
  try { b = (await request.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  if (!b || typeof b !== "object") return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  if (!OFFER_SCOPES.includes(b.scope as OfferScope)) return NextResponse.json({ error: "invalid_scope" }, { status: 400 });
  if (!DISCOUNT_TYPES.includes(b.discountType as DiscountType)) return NextResponse.json({ error: "invalid_discount_type" }, { status: 400 });
  const scope = b.scope as OfferScope;
  const type = b.discountType as DiscountType;
  const value = parseDiscountValue(type, b.discountValue);
  if ("error" in value) return NextResponse.json({ error: value.error }, { status: 400 });
  const productIds = Array.isArray(b.productIds)
    ? [...new Set(b.productIds.filter((x): x is number => Number.isInteger(x) && x > 0))].slice(0, LIMITS.maxProducts)
    : [];
  const categoryId = Number.isInteger(b.categoryId) ? (b.categoryId as number) : undefined;
  if (scope === "category" && categoryId === undefined) return NextResponse.json({ error: "category_required" }, { status: 400 });
  if (scope === "product" && productIds.length === 0) return NextResponse.json({ error: "products_required" }, { status: 400 });
  const excludeOfferId = Number.isInteger(b.excludeOfferId) ? (b.excludeOfferId as number) : undefined;
  const preview = await buildOfferPreview({ scope, categoryId, productIds, discountType: type, discountValue: value.value, stackable: b.stackable === true, excludeOfferId });
  return NextResponse.json(preview);
}
