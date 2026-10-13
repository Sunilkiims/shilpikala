export const AD_TYPES = ["hero", "carousel", "category_banner", "gif"] as const;
export type AdType = (typeof AD_TYPES)[number];

export const PLACEMENTS = ["home_hero", "home_carousel", "home_category", "category_page"] as const;
export type Placement = (typeof PLACEMENTS)[number];

export const DEST_TYPES = ["none", "product", "category", "collection", "products", "route", "external"] as const;
export type DestType = (typeof DEST_TYPES)[number];

export const SOURCE_TYPES = ["manual", "category", "collection", "new_arrivals", "on_sale", "bestsellers"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const AD_STATUSES = ["draft", "scheduled", "active", "expired", "disabled"] as const;
export type AdStatus = (typeof AD_STATUSES)[number];

export const TYPE_LABEL: Record<AdType, string> = {
  hero: "Festive hero banner",
  carousel: "Product deal carousel",
  category_banner: "Category promotion",
  gif: "GIF advertisement",
};

export const PLACEMENT_LABEL: Record<Placement, string> = {
  home_hero: "Homepage hero banner",
  home_carousel: "Homepage promotional carousel",
  home_category: "Homepage category promotion",
  category_page: "Category page promotion",
};

/** Which placements make sense for each ad type. */
export const PLACEMENTS_FOR_TYPE: Record<AdType, Placement[]> = {
  hero: ["home_hero"],
  carousel: ["home_carousel", "category_page"],
  category_banner: ["home_category", "category_page"],
  gif: ["home_hero", "home_category", "category_page"],
};

export const SOURCE_LABEL: Record<SourceType, string> = {
  manual: "Hand-picked products",
  category: "All products in a category",
  collection: "A collection",
  new_arrivals: "Newest products",
  on_sale: "Products on sale (biggest discount first)",
  bestsellers: "Bestsellers (from real orders)",
};

export const DEST_LABEL: Record<DestType, string> = {
  none: "No link",
  product: "A single product",
  category: "A product category",
  collection: "A collection",
  products: "Several hand-picked products",
  route: "A page on this website",
  external: "An external website",
};

export const LIMITS = {
  maxMediaBytes: 4 * 1024 * 1024, // stays under Vercel's 4.5 MB request-body limit
  maxDimension: 6000,
  maxProducts: 50,
  maxItems: 24,
} as const;

export type AdRecord = {
  id: number;
  name: string;
  type: AdType;
  placement: Placement;
  heading?: string;
  subtitle?: string;
  badge?: string;
  ctaText?: string;
  desktopMediaId?: number;
  mobileMediaId?: number;
  thumbMediaId?: number;
  destType: DestType;
  destRef?: string;
  destProductIds: number[];
  categoryId?: number;
  sourceType?: SourceType;
  sourceRef?: number;
  productIds: number[];
  maxItems: number;
  showDiscount: boolean;
  /** Carousel only: list just the products that currently have a discount. */
  discountedOnly: boolean;
  startsAt?: string;
  endsAt?: string;
  priority: number;
  position: number;
  enabled: boolean;
  published: boolean;
  createdAt: string;
  updatedAt: string;
};

/** What the admin form sends / the store saves. */
export type AdInput = Omit<AdRecord, "id" | "position" | "createdAt" | "updatedAt">;

export type MediaInfo = { id: number; src: string; width: number; height: number; animated: boolean; mime: string; size: number };

export type Collection = { id: number; name: string; slug: string; description?: string; productIds: number[] };

export function computeStatus(ad: Pick<AdRecord, "published" | "enabled" | "startsAt" | "endsAt">, now = new Date()): AdStatus {
  if (!ad.published) return "draft";
  if (!ad.enabled) return "disabled";
  if (ad.endsAt && new Date(ad.endsAt).getTime() <= now.getTime()) return "expired";
  if (ad.startsAt && new Date(ad.startsAt).getTime() > now.getTime()) return "scheduled";
  return "active";
}
