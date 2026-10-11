// Client-safe: no database imports. Shared by the server query layer and the filter UI.

export const SORT_KEYS = ["recommended", "price-asc", "price-desc", "newest", "bestselling", "rating"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const PAGE_SIZE = 12;

export type CatalogQuery = {
  q?: string;
  categories?: string[];
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  onSale?: boolean;
  customizable?: boolean;
  materials?: string[];
  colors?: string[];
  artStyles?: string[];
  /** Only products whose genuine average review rating is at least this. */
  minRating?: number;
  sort?: SortKey;
  page?: number;
  pageSize?: number;
};
