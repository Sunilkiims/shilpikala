/**
 * Minimal shapes for the fields we read from the WooCommerce REST API
 * (v3). These describe the wire format, which is intentionally kept
 * separate from our own `Product` / `Category` types in
 * src/types/woocommerce.ts — the mappers in mappers.ts translate
 * between the two so the rest of the app never sees raw API shapes.
 */

export interface WooRawImage {
  id: number;
  src: string;
  alt: string;
}

export interface WooRawCategoryRef {
  id: number;
  name: string;
  slug: string;
}

export interface WooRawCategory {
  id: number;
  name: string;
  slug: string;
  description: string;
  parent: number;
  image: WooRawImage | null;
}

export interface WooRawVariation {
  id: number;
  attributes: { name: string; option: string }[];
  price: string;
  sale_price: string;
  stock_status: "instock" | "outofstock" | "onbackorder";
  image: WooRawImage | null;
}

export interface WooRawReview {
  id: number;
  reviewer: string;
  rating: number;
  review: string;
  date_created: string;
}

export interface WooRawProduct {
  id: number;
  name: string;
  slug: string;
  description: string;
  short_description: string;
  price: string;
  regular_price: string;
  sale_price: string;
  on_sale: boolean;
  stock_status: "instock" | "outofstock" | "onbackorder";
  categories: WooRawCategoryRef[];
  images: WooRawImage[];
  average_rating: string;
}
