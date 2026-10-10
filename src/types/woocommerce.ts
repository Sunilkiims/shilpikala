/**
 * Minimal domain types for the future WooCommerce integration.
 * These describe the shape of data ShilpiKala will consume once the
 * store connects to the WooCommerce REST API. No API calls are made
 * from this file — it exists purely as shared type architecture.
 */

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
  categories: Category[];
  images: ProductImage[];
  variations?: ProductVariation[];
  reviews?: Review[];
  averageRating?: number;
}

export interface CartItem {
  productId: number;
  variationId?: number;
  name: string;
  slug: string;
  image?: ProductImage;
  quantity: number;
  price: string;
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
