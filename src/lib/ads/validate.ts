import { getAllCategories, getAllProducts } from "@/lib/catalog";
import { parseExternalUrl, parseInternalRoute } from "@/lib/ads/destination";
import { getCollection, getMediaInfo } from "@/lib/ads/store";
import {
  AD_TYPES, DEST_TYPES, LIMITS, PLACEMENTS_FOR_TYPE, SOURCE_TYPES,
  type AdInput, type AdType, type DestType, type SourceType,
} from "@/lib/ads/types";

export type ParseResult = { ok: true; value: AdInput } | { ok: false; error: string; field?: string };
const fail = (error: string, field?: string): ParseResult => ({ ok: false, error, field });

const text = (v: unknown, max: number): string | undefined | null => {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") return null;
  const t = v.trim().replace(/\s+/g, " ");
  if (t.length > max) return null;
  return t || undefined;
};
const int = (v: unknown): number | undefined => (typeof v === "number" && Number.isInteger(v) ? v : undefined);
const idList = (v: unknown): number[] | undefined => {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.length > LIMITS.maxProducts) return undefined;
  const out: number[] = [];
  for (const x of v) {
    if (!Number.isInteger(x) || (x as number) < 1) return undefined;
    if (!out.includes(x as number)) out.push(x as number);
  }
  return out;
};
const date = (v: unknown): string | undefined | null => {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v !== "string") return null;
  const t = new Date(v);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
};

/** Validates everything an admin can send, including that referenced products, categories, collections and uploads exist. */
export async function parseAdInput(body: unknown): Promise<ParseResult> {
  if (!body || typeof body !== "object" || Array.isArray(body)) return fail("invalid_body");
  const b = body as Record<string, unknown>;

  const name = text(b.name, 120);
  if (!name) return fail("name_required", "name");
  if (typeof b.type !== "string" || !AD_TYPES.includes(b.type as AdType)) return fail("invalid_type", "type");
  const type = b.type as AdType;
  if (typeof b.placement !== "string" || !PLACEMENTS_FOR_TYPE[type].some((p) => p === b.placement)) return fail("invalid_placement", "placement");
  const placement = b.placement as AdInput["placement"];

  const heading = text(b.heading, 120), subtitle = text(b.subtitle, 300), badge = text(b.badge, 40), ctaText = text(b.ctaText, 30);
  if (heading === null) return fail("heading_too_long", "heading");
  if (subtitle === null) return fail("subtitle_too_long", "subtitle");
  if (badge === null) return fail("badge_too_long", "badge");
  if (ctaText === null) return fail("cta_too_long", "ctaText");

  const published = b.published === true;
  const enabled = b.enabled !== false;
  const showDiscount = b.showDiscount !== false;
  const discountedOnly = type === "carousel" && b.discountedOnly === true;

  const priority = b.priority === undefined ? 0 : int(b.priority);
  if (priority === undefined || priority < -1000 || priority > 1000) return fail("invalid_priority", "priority");

  const startsAt = date(b.startsAt), endsAt = date(b.endsAt);
  if (startsAt === null) return fail("invalid_start_date", "startsAt");
  if (endsAt === null) return fail("invalid_end_date", "endsAt");
  if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) return fail("end_before_start", "endsAt");

  // ---- media
  const mediaIds = (["desktopMediaId", "mobileMediaId", "thumbMediaId"] as const).map((k) => {
    const v = b[k];
    return v === undefined || v === null ? undefined : int(v) ?? NaN;
  });
  if (mediaIds.some((v) => Number.isNaN(v))) return fail("invalid_media", "media");
  const given = mediaIds.filter((v): v is number => v !== undefined);
  if (given.length) {
    const found = await getMediaInfo(given);
    if (given.some((i) => !found.has(i))) return fail("media_not_found", "media");
  }
  const [desktopMediaId, mobileMediaId, thumbMediaId] = mediaIds as [number?, number?, number?];
  if (type !== "carousel" && published && desktopMediaId === undefined && mobileMediaId === undefined) {
    return fail("media_required", "media");
  }

  const [products, categories] = await Promise.all([getAllProducts(), getAllCategories()]);
  const productIds = new Set(products.map((p) => p.id));
  const categoryIds = new Set(categories.map((c) => c.id));

  // ---- destination
  if (typeof b.destType !== "string" || !DEST_TYPES.includes(b.destType as DestType)) return fail("invalid_destination", "destType");
  const destType = b.destType as DestType;
  let destRef: string | undefined;
  let destProductIds: number[] = [];
  if (destType === "product") {
    const id = int(b.destRef === undefined || b.destRef === null || b.destRef === "" ? undefined : Number(b.destRef));
    if (id === undefined || !productIds.has(id)) return fail("product_not_found", "destRef");
    destRef = String(id);
  } else if (destType === "category") {
    const id = int(Number(b.destRef));
    if (id === undefined || !categoryIds.has(id)) return fail("category_not_found", "destRef");
    destRef = String(id);
  } else if (destType === "collection") {
    const id = int(Number(b.destRef));
    if (id === undefined || !(await getCollection(id))) return fail("collection_not_found", "destRef");
    destRef = String(id);
  } else if (destType === "products") {
    const list = idList(b.destProductIds);
    if (!list || list.length === 0) return fail("products_required", "destProductIds");
    if (list.some((i) => !productIds.has(i))) return fail("product_not_found", "destProductIds");
    destProductIds = list;
  } else if (destType === "route") {
    destRef = parseInternalRoute(b.destRef);
    if (!destRef) return fail("invalid_route", "destRef");
  } else if (destType === "external") {
    destRef = parseExternalUrl(b.destRef);
    if (!destRef) return fail("invalid_url", "destRef");
  }

  // ---- scope + carousel config
  let categoryId: number | undefined;
  if (placement === "category_page" && b.categoryId !== undefined && b.categoryId !== null && b.categoryId !== "") {
    categoryId = int(Number(b.categoryId));
    if (categoryId === undefined || !categoryIds.has(categoryId)) return fail("category_not_found", "categoryId");
  }

  let sourceType: SourceType | undefined, sourceRef: number | undefined, productList: number[] = [], maxItems = 12;
  if (type === "carousel") {
    if (typeof b.sourceType !== "string" || !SOURCE_TYPES.includes(b.sourceType as SourceType)) return fail("invalid_source", "sourceType");
    sourceType = b.sourceType as SourceType;
    maxItems = b.maxItems === undefined ? 12 : (int(b.maxItems) ?? 0);
    if (maxItems < 1 || maxItems > LIMITS.maxItems) return fail("invalid_max_items", "maxItems");
    if (sourceType === "manual") {
      const list = idList(b.productIds);
      if (!list || list.length === 0) return fail("products_required", "productIds");
      if (list.some((i) => !productIds.has(i))) return fail("product_not_found", "productIds");
      productList = list;
    } else if (sourceType === "category") {
      sourceRef = int(Number(b.sourceRef));
      if (sourceRef === undefined || !categoryIds.has(sourceRef)) return fail("category_not_found", "sourceRef");
    } else if (sourceType === "collection") {
      sourceRef = int(Number(b.sourceRef));
      if (sourceRef === undefined || !(await getCollection(sourceRef))) return fail("collection_not_found", "sourceRef");
    }
  }

  return {
    ok: true,
    value: {
      name, type, placement, heading, subtitle, badge, ctaText,
      desktopMediaId, mobileMediaId, thumbMediaId,
      destType, destRef, destProductIds, categoryId,
      sourceType, sourceRef, productIds: productList, maxItems, showDiscount, discountedOnly,
      startsAt: startsAt ?? undefined, endsAt: endsAt ?? undefined, priority, enabled, published,
    },
  };
}
