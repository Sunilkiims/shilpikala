import type { Product } from "@/types/catalog";
import { categories } from "@/data/categories";

function categoryBySlug(slug: string) {
  const category = categories.find((c) => c.slug === slug);
  if (!category) throw new Error(`Unknown category slug: ${slug}`);
  return category;
}

/**
 * Seed catalogue, used once to populate storage/catalog.json the first
 * time the site runs (see src/lib/store/catalogStore.ts). After that,
 * the admin area at /admin/products is the real source of truth —
 * editing products there does not touch this file. `images` is
 * intentionally empty until real photography is added to
 * public/images/products — ProductCard renders an on-brand placeholder
 * in its place.
 */
export const products: Product[] = [
  {
    id: 1,
    name: "Concentric Bloom Mandala",
    slug: "concentric-bloom-mandala",
    description:
      "A hand-drawn mandala built from eight repeating petal rings, finished in fine terracotta ink on cream board. Framed and ready to hang.",
    shortDescription: "Hand-drawn mandala in fine terracotta ink.",
    price: "4500.00",
    regularPrice: "4500.00",
    onSale: false,
    inStock: true,
    categories: [categoryBySlug("mandala-art"), categoryBySlug("wall-art")],
    images: [],
    averageRating: 4.8,
  },
  {
    id: 2,
    name: "Dotwork Lotus Mandala",
    slug: "dotwork-lotus-mandala",
    description:
      "A stippled lotus mandala built point by point, in deep olive and muted gold. A quieter, more textural take on the form.",
    shortDescription: "Stippled lotus mandala in olive and gold.",
    price: "3800.00",
    regularPrice: "4200.00",
    salePrice: "3800.00",
    onSale: true,
    inStock: true,
    categories: [categoryBySlug("mandala-art"), categoryBySlug("decorative-art")],
    images: [],
    averageRating: 4.6,
  },
  {
    id: 3,
    name: "Terracotta Mirror Wall Panel",
    slug: "terracotta-mirror-wall-panel",
    description:
      "A relief panel in traditional Lipan style — raised terracotta clay work inlaid with small mirror fragments, cured and sealed by hand.",
    shortDescription: "Lipan relief panel with inlaid mirror work.",
    price: "6200.00",
    regularPrice: "6200.00",
    onSale: false,
    inStock: true,
    categories: [categoryBySlug("lipan-art"), categoryBySlug("wall-art")],
    images: [],
    averageRating: 4.9,
  },
  {
    id: 4,
    name: "Lipan Peacock Relief",
    slug: "lipan-peacock-relief",
    description:
      "A peacock motif in raised clay relief, a recurring figure in Kutch mirror work, finished with hand-set mirror chips along the tail.",
    shortDescription: "Peacock motif in raised clay relief.",
    price: "5400.00",
    regularPrice: "5400.00",
    onSale: false,
    inStock: true,
    categories: [categoryBySlug("lipan-art"), categoryBySlug("art-gifts")],
    images: [],
    averageRating: 4.7,
  },
  {
    id: 5,
    name: "Hand-Thrown Terracotta Vase Set",
    slug: "hand-thrown-terracotta-vase-set",
    description:
      "A set of three terracotta vases thrown and finished by hand, each slightly different, for console tables and shelves.",
    shortDescription: "Three hand-thrown terracotta vases.",
    price: "2600.00",
    regularPrice: "2600.00",
    onSale: false,
    inStock: true,
    categories: [categoryBySlug("handmade-art"), categoryBySlug("decorative-art")],
    images: [],
    averageRating: 4.5,
  },
  {
    id: 6,
    name: "Woven Wall Hanging, Earth Tones",
    slug: "woven-wall-hanging-earth-tones",
    description:
      "A handwoven wall hanging in undyed cotton and jute, in a palette of ivory, earth brown and muted gold.",
    shortDescription: "Handwoven wall hanging in earth tones.",
    price: "3200.00",
    regularPrice: "3600.00",
    salePrice: "3200.00",
    onSale: true,
    inStock: true,
    categories: [categoryBySlug("handmade-art"), categoryBySlug("wall-art")],
    images: [],
    averageRating: 4.4,
  },
  {
    id: 7,
    name: "Large Format Mandala Canvas",
    slug: "large-format-mandala-canvas",
    description:
      "A statement-sized mandala rendered on stretched canvas, built for a focal wall rather than a shelf.",
    shortDescription: "Statement-sized mandala on stretched canvas.",
    price: "8900.00",
    regularPrice: "8900.00",
    onSale: false,
    inStock: true,
    categories: [categoryBySlug("mandala-art"), categoryBySlug("wall-art")],
    images: [],
    averageRating: 4.9,
  },
  {
    id: 8,
    name: "Mirror-Inlay Terracotta Coasters",
    slug: "mirror-inlay-terracotta-coasters",
    description:
      "A set of four terracotta coasters with miniature Lipan-style mirror inlay, sealed for everyday use.",
    shortDescription: "Set of four Lipan-style mirror coasters.",
    price: "1200.00",
    regularPrice: "1200.00",
    onSale: false,
    inStock: true,
    categories: [categoryBySlug("lipan-art"), categoryBySlug("art-gifts")],
    images: [],
    averageRating: 4.3,
  },
  {
    id: 9,
    name: "Olive & Gold Mandala Clock",
    slug: "olive-gold-mandala-clock",
    description:
      "A working wall clock built around a hand-painted mandala face, in olive, gold and charcoal.",
    shortDescription: "Wall clock with a hand-painted mandala face.",
    price: "2950.00",
    regularPrice: "2950.00",
    onSale: false,
    inStock: false,
    categories: [categoryBySlug("mandala-art"), categoryBySlug("decorative-art")],
    images: [],
    averageRating: 4.6,
  },
  {
    id: 10,
    name: "Hand-Carved Wooden Trinket Box",
    slug: "hand-carved-wooden-trinket-box",
    description:
      "A small lidded box carved by hand from reclaimed teak, finished with a simple geometric border.",
    shortDescription: "Hand-carved teak trinket box.",
    price: "1800.00",
    regularPrice: "1800.00",
    onSale: false,
    inStock: true,
    categories: [categoryBySlug("handmade-art"), categoryBySlug("art-gifts")],
    images: [],
    averageRating: 4.5,
  },
  {
    id: 11,
    name: "Custom Mandala Portrait Commission",
    slug: "custom-mandala-portrait-commission",
    description:
      "A made-to-order mandala built around a date, name or motif of your choosing — a popular piece for weddings and anniversaries.",
    shortDescription: "Made-to-order mandala built around your story.",
    price: "5000.00",
    regularPrice: "5000.00",
    onSale: false,
    inStock: true,
    categories: [categoryBySlug("custom-art"), categoryBySlug("art-gifts")],
    images: [],
    averageRating: 5,
  },
  {
    id: 12,
    name: "Custom Lipan Nameplate",
    slug: "custom-lipan-nameplate",
    description:
      "A house nameplate finished in raised Lipan relief with mirror inlay, made to order with your family name or house number.",
    shortDescription: "Made-to-order Lipan relief nameplate.",
    price: "3400.00",
    regularPrice: "3400.00",
    onSale: false,
    inStock: true,
    categories: [categoryBySlug("custom-art"), categoryBySlug("lipan-art")],
    images: [],
    averageRating: 4.8,
  },
  {
    id: 13,
    name: "Petite Mandala Gift Cards (Set of 6)",
    slug: "petite-mandala-gift-cards",
    description:
      "Six blank cards printed from original mandala line work, with envelopes, for gifting alongside a piece or on their own.",
    shortDescription: "Six blank cards printed from original line work.",
    price: "650.00",
    regularPrice: "650.00",
    onSale: false,
    inStock: true,
    categories: [categoryBySlug("art-gifts"), categoryBySlug("mandala-art")],
    images: [],
    averageRating: 4.2,
  },
  {
    id: 14,
    name: "Terracotta Tea-Light Holders (Set of 3)",
    slug: "terracotta-tea-light-holders",
    description:
      "Three small tea-light holders in raised terracotta relief, each with a different perforated pattern for the light to pass through.",
    shortDescription: "Three perforated terracotta tea-light holders.",
    price: "1450.00",
    regularPrice: "1450.00",
    onSale: false,
    inStock: true,
    categories: [categoryBySlug("lipan-art"), categoryBySlug("decorative-art")],
    images: [],
    averageRating: 4.4,
  },
];

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((product) => product.slug === slug);
}

export function getProductById(id: number): Product | undefined {
  return products.find((product) => product.id === id);
}

export function getProductsByCategorySlug(categorySlug: string): Product[] {
  return products.filter((product) =>
    product.categories.some((category) => category.slug === categorySlug)
  );
}
