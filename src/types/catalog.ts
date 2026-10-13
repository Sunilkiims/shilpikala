/**
 * Core domain types for the ShilpiKala catalogue, cart, and orders.
 * This is our own data model — not tied to any external commerce
 * platform — backed by the file-based store in src/lib/store/.
 */

import type { ProductPricing } from "@/lib/offers/types";

export interface ProductImage {
  id: number;
  src: string;
  alt: string;
}

export interface ProductVariation {
  id: number;
  attributes: Record<string, string>;
  price: string;
  salePrice?: string;
  inStock: boolean;
  image?: ProductImage;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string;
  image?: ProductImage;
  parentId?: number;
}

export interface Review {
  id: number;
  author: string;
  rating: number;
  content: string;
  createdAt: string;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  price: string;
  regularPrice: string;
  salePrice?: string;
  onSale: boolean;
  inStock: boolean;
  /**
   * Tracked units remaining. Optional — when set, it's the source of
   * truth for `inStock` (auto-derived, decremented after a verified
   * payment). Left undefined for made-to-order/custom pieces, where
   * `inStock` stays a manual toggle in the admin form.
   */
  stockQuantity?: number;
  categories: Category[];
  images: ProductImage[];
  variations?: ProductVariation[];
  reviews?: Review[];
  averageRating?: number;
  /**
   * Set (by src/lib/catalog.ts) only when a discount offer applies right now. Never
   * stored with the product; always recomputed from the live offers.
   */
  pricing?: ProductPricing;
}

export interface CartItem {
  productId: number;
  variationId?: number;
  name: string;
  slug: string;
  image?: ProductImage;
  quantity: number;
  /** Unit price the customer pays. Re-checked against the server in the cart and at checkout. */
  price: string;
  /** Price before an offer, for the strikethrough. Display only. */
  originalPrice?: string;
  percentOff?: number;
  offerLabel?: string;
  /** The product has been removed from the shop since it was added. */
  unavailable?: boolean;
}

export interface Address {
  fullName: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export interface Customer {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  billing?: Address;
  shipping?: Address;
}

export type OrderStatus =
  | "pending"
  | "processing"
  | "on-hold"
  | "completed"
  | "cancelled"
  | "refunded"
  | "failed";

export interface Order {
  id: number;
  status: OrderStatus;
  total: string;
  currency: string;
  items: CartItem[];
  billing: Address;
  shipping: Address;
  createdAt: string;
}
