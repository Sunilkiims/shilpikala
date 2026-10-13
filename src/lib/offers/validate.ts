import { getCategories, getProducts } from "@/lib/store/catalogStore";
import { applyDiscount, MAX_PERCENT_BP, DISCOUNT_TYPES, type DiscountType } from "@/lib/offers/money";
import { currentPricePaise } from "@/lib/offers/resolve";
import { LIMITS, OFFER_SCOPES, type OfferInput, type OfferScope } from "@/lib/offers/types";

export type OfferParse =
  | { ok: true; value: OfferInput }
  | { ok: false; error: string; field?: string; products?: string[] };
const fail = (error: string, field?: string, products?: string[]): OfferParse => ({ ok: false, error, field, ...(products ? { products } : {}) });

const text = (v: unknown, max: number): string | undefined | null => {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") return null;
  const t = v.trim().replace(/\s+/g, " ");
  if (t.length > max) return null;
  return t || undefined;
};
const date = (v: unknown): string | undefined | null => {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v !== "string") return null;
  const t = new Date(v);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
};

/**
 * Turns what an admin typed ("20", "12.5", "100.50") into stored units, or an error code.
 * Percent -> hundredths of a percent; fixed -> paise. Nothing here uses floating point.
 */
export function parseDiscountValue(type: DiscountType, raw: unknown): { value: number } | { error: string } {
  const s = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
  if (s === "") return { error: "discount_required" };
  if (/^-/.test(s)) return { error: "negative_discount" };
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(s)) return { error: "invalid_discount" };
  const [w, f = ""] = s.split(".");
  const v = Number(w) * 100 + Number(f.padEnd(2, "0"));
  if (v <= 0) return { error: "invalid_discount" };
  if (type === "percent" && v > MAX_PERCENT_BP) return { error: v >= 10000 ? "percent_too_high" : "invalid_discount" };
  return { value: v };
}

/** Validates everything an admin can send, against the real catalogue and its current prices. */
export async function parseOfferInput(body: unknown): Promise<OfferParse> {
  if (!body || typeof body !== "object" || Array.isArray(body)) return fail("invalid_body");
  const b = body as Record<string, unknown>;

  const name = text(b.name, LIMITS.nameMax);
  if (name === null) return fail("name_too_long", "name");
  if (!name) return fail("name_required", "name");
  const badge = text(b.badge, LIMITS.badgeMax);
  if (badge === null) return fail("badge_too_long", "badge");

  if (typeof b.scope !== "string" || !OFFER_SCOPES.includes(b.scope as OfferScope)) return fail("invalid_scope", "scope");
  const scope = b.scope as OfferScope;
  if (typeof b.discountType !== "string" || !DISCOUNT_TYPES.includes(b.discountType as DiscountType)) return fail("invalid_discount_type", "discountType");
  const discountType = b.discountType as DiscountType;
  const parsed = parseDiscountValue(discountType, b.discountValue);
  if ("error" in parsed) return fail(parsed.error, "discountValue");
  const discountValue = parsed.value;

  const published = b.published === true;
  const enabled = b.enabled !== false;
  const stackable = scope === "category" && b.stackable === true;

  const startsAt = date(b.startsAt), endsAt = date(b.endsAt);
  if (startsAt === null) return fail("invalid_start_date", "startsAt");
  if (endsAt === null) return fail("invalid_end_date", "endsAt");
  if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) return fail("end_before_start", "endsAt");
  if (endsAt && new Date(endsAt) <= new Date()) return fail("end_in_past", "endsAt");

  // Raw catalogue (no offers applied) - discounts are validated against the real current price.
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);

  let categoryId: number | undefined;
  let productIds: number[] = [];

  if (scope === "category") {
    const id = Number(b.categoryId);
    if (!Number.isInteger(id) || !categories.some((c) => c.id === id)) return fail(b.categoryId ? "category_not_found" : "category_required", "categoryId");
    categoryId = id;
    // Products priced below a fixed discount are skipped at sale time. Only refuse when NOTHING in the category can be discounted.
    const inCat = products.filter((p) => p.categories.some((c) => c.id === id));
    if (inCat.length > 0 && inCat.every((p) => { const base = currentPricePaise(p); return base === null || applyDiscount(base, discountType, discountValue) === null; })) {
      return fail("discount_exceeds_price", "discountValue");
    }
  } else {
    const list = b.productIds;
    if (!Array.isArray(list) || list.length === 0) return fail("products_required", "productIds");
    if (list.length > LIMITS.maxProducts) return fail("too_many_products", "productIds");
    const seen = new Set<number>();
    for (const x of list) {
      if (!Number.isInteger(x) || (x as number) < 1) return fail("product_not_found", "productIds");
      seen.add(x as number);
    }
    productIds = [...seen];
    const byId = new Map(products.map((p) => [p.id, p]));
    if (productIds.some((id) => !byId.has(id))) return fail("product_not_found", "productIds");
    const bad = productIds
      .map((id) => byId.get(id)!)
      .filter((p) => { const base = currentPricePaise(p); return base === null || applyDiscount(base, discountType, discountValue) === null; });
    if (bad.length) return fail("discount_exceeds_price", "discountValue", bad.map((p) => p.name));
  }

  return {
    ok: true,
    value: { name, scope, categoryId, productIds, discountType, discountValue, badge, stackable, startsAt: startsAt ?? undefined, endsAt: endsAt ?? undefined, enabled, published },
  };
}
