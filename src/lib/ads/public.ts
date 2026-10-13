import { cache } from "react";
import { getAllCategories, getAllProducts } from "@/lib/catalog";
import { getDb } from "@/lib/db";
import { num } from "@/lib/db/rows";
import { parseExternalUrl, parseInternalRoute } from "@/lib/ads/destination";
import { getCollection, getMediaInfo, listCollections, listLiveAds } from "@/lib/ads/store";
import type { AdRecord, AdType, Collection, MediaInfo, Placement, SourceType } from "@/lib/ads/types";
import type { Category, Product } from "@/types/catalog";

export type RenderMedia = { src: string; width: number; height: number; animated: boolean };

export type CardProduct = {
  id: number; name: string; slug: string; price: string; regularPrice: string; onSale: boolean; inStock: boolean;
  /** Only set when the product's real sale price is below its regular price. */
  discountPercent?: number;
  image?: { src: string; alt: string };
};

export type RenderableAd = {
  id: number; type: AdType; heading?: string; subtitle?: string; badge?: string; ctaText?: string;
  href?: string; external?: boolean;
  desktop?: RenderMedia; mobile?: RenderMedia;
  products?: CardProduct[]; viewAllHref?: string; showDiscount: boolean;
};

type Ctx = { products: Product[]; categories: Category[]; collections: Collection[] };

export const toCard = (p: Product): CardProduct => {
  const sale = p.onSale && p.salePrice ? Number(p.salePrice) : undefined;
  const regular = Number(p.regularPrice);
  const discountPercent =
    sale !== undefined && regular > 0 && sale < regular ? Math.round(((regular - sale) / regular) * 100) : undefined;
  return {
    id: p.id, name: p.name, slug: p.slug, price: p.price, regularPrice: p.regularPrice, onSale: Boolean(p.onSale && p.salePrice),
    inStock: p.inStock && (p.stockQuantity === undefined || p.stockQuantity > 0),
    ...(discountPercent ? { discountPercent } : {}),
    ...(p.images[0] ? { image: { src: p.images[0].src, alt: p.images[0].alt || p.name } } : {}),
  };
};

async function loadCtx(): Promise<Ctx> {
  const [products, categories, collections] = await Promise.all([getAllProducts(), getAllCategories(), listCollections()]);
  return { products, categories, collections };
}

/** Units sold per product, from real orders that were not cancelled or refunded. */
async function bestsellerIds(limit: number): Promise<number[]> {
  const db = await getDb();
  const res = await db.query<{ pid: number }>(
    `SELECT (item->>'productId')::int AS pid, SUM(COALESCE((item->>'quantity')::int, 1)) AS qty
       FROM orders, jsonb_array_elements(items) AS item
      WHERE status NOT IN ('cancelled','refunded') AND item ? 'productId'
      GROUP BY pid ORDER BY qty DESC, pid LIMIT $1`,
    [limit]
  );
  return res.rows.map((r) => num(r.pid));
}

export type CarouselConfig = { sourceType?: SourceType; sourceRef?: number; productIds: number[]; maxItems: number };

/** The one place that decides which products a carousel shows; the storefront and the admin preview both use it. */
export async function pickCarouselProducts(cfg: CarouselConfig, ctx?: Ctx): Promise<Product[]> {
  const c = ctx ?? (await loadCtx());
  const byId = new Map(c.products.map((p) => [p.id, p]));
  const inOrder = (ids: number[]) => ids.map((i) => byId.get(i)).filter((p): p is Product => Boolean(p));
  let list: Product[] = [];
  switch (cfg.sourceType ?? "manual") {
    case "manual": list = inOrder(cfg.productIds); break;
    case "category": list = c.products.filter((p) => p.categories.some((x) => x.id === cfg.sourceRef)).sort((a, b) => b.id - a.id); break;
    case "collection": {
      const col = cfg.sourceRef ? (c.collections.find((x) => x.id === cfg.sourceRef) ?? (await getCollection(cfg.sourceRef))) : undefined;
      list = col ? inOrder(col.productIds) : [];
      break;
    }
    case "new_arrivals": list = [...c.products].sort((a, b) => b.id - a.id); break;
    case "on_sale": {
      const off = (p: Product) => Number(p.regularPrice) - Number(p.salePrice);
      list = c.products.filter((p) => p.onSale && p.salePrice && Number(p.salePrice) < Number(p.regularPrice)).sort((a, b) => off(b) / Number(b.regularPrice) - off(a) / Number(a.regularPrice));
      break;
    }
    case "bestsellers": list = inOrder(await bestsellerIds(cfg.maxItems * 2)); break;
  }
  return list.slice(0, cfg.maxItems);
}

/**
 * Turns an ad's configured destination into a link. `undefined` = no link was configured;
 * `null` = one was, but it points at something that no longer exists (a deleted product, say).
 */
export function resolveDestination(ad: AdRecord, ctx: Ctx): { href: string; external?: boolean } | undefined | null {
  switch (ad.destType) {
    case "none": return undefined;
    case "product": {
      const p = ctx.products.find((x) => String(x.id) === ad.destRef);
      return p ? { href: `/product/${p.slug}` } : null;
    }
    case "category": {
      const c = ctx.categories.find((x) => String(x.id) === ad.destRef);
      return c ? { href: `/categories/${c.slug}` } : null;
    }
    case "collection": {
      const c = ctx.collections.find((x) => String(x.id) === ad.destRef);
      return c ? { href: `/collections/${c.slug}` } : null;
    }
    case "products": {
      const live = ad.destProductIds.filter((i) => ctx.products.some((p) => p.id === i));
      return live.length ? { href: `/promotions/${ad.id}` } : null;
    }
    case "route": {
      const r = parseInternalRoute(ad.destRef);
      return r ? { href: r } : null;
    }
    case "external": {
      const u = parseExternalUrl(ad.destRef);
      return u ? { href: u, external: true } : null;
    }
  }
}

const media = (m: MediaInfo | undefined): RenderMedia | undefined =>
  m ? { src: m.src, width: m.width, height: m.height, animated: m.animated } : undefined;

/** Builds the customer-facing version of an ad, or undefined when it should not be shown at all. */
export async function toRenderable(ad: AdRecord, ctx: Ctx, mediaMap: Map<number, MediaInfo>): Promise<RenderableAd | undefined> {
  const dest = resolveDestination(ad, ctx);
  if (dest === null) return undefined; // configured destination is gone: hide rather than show a dead banner
  const desktop = media(ad.desktopMediaId ? mediaMap.get(ad.desktopMediaId) : undefined);
  const mobile = media(ad.mobileMediaId ? mediaMap.get(ad.mobileMediaId) : undefined);
  const base = {
    id: ad.id, type: ad.type, heading: ad.heading, subtitle: ad.subtitle, badge: ad.badge, ctaText: ad.ctaText,
    ...(dest ? { href: dest.href, external: dest.external } : {}),
    desktop: desktop ?? mobile, mobile: mobile ?? desktop, showDiscount: ad.showDiscount,
  };
  if (ad.type !== "carousel") return base.desktop ? base : undefined;

  const products = await pickCarouselProducts(
    { sourceType: ad.sourceType, sourceRef: ad.sourceRef, productIds: ad.productIds, maxItems: ad.maxItems }, ctx
  );
  if (products.length === 0) return undefined;
  return { ...base, products: products.map(toCard), viewAllHref: dest?.href };
}

/** Everything live for one placement, in display order. Cached per request. */
export const getLiveRenderableAds = cache(async (placement: Placement, categoryId = 0): Promise<RenderableAd[]> => {
  const ads = (await listLiveAds(placement)).filter((a) => placement !== "category_page" || a.categoryId === undefined || a.categoryId === categoryId);
  if (ads.length === 0) return [];
  const ctx = await loadCtx();
  const mediaMap = await getMediaInfo(ads.flatMap((a) => [a.desktopMediaId, a.mobileMediaId].filter((x): x is number => x !== undefined)));
  const out = await Promise.all(ads.map((a) => toRenderable(a, ctx, mediaMap)));
  return out.filter((x): x is RenderableAd => x !== undefined);
});

/** For the admin list: is this ad's configured destination still valid? */
export async function destinationIsBroken(ads: AdRecord[]): Promise<Set<number>> {
  if (ads.length === 0) return new Set();
  const ctx = await loadCtx();
  return new Set(ads.filter((a) => resolveDestination(a, ctx) === null).map((a) => a.id));
}

export { loadCtx as loadAdContext };
export type { Ctx as AdContext };
