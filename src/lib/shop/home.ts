import { cache } from "react";
import type { Product } from "@/types/catalog";
import { getBestSellers, queryProducts } from "@/lib/store/catalogQuery";
import { getNavModel, type NavModel } from "@/lib/shop/storefront";
import { discountPercent } from "@/lib/shop/pricing";
import type { HeroSlide } from "@/components/sections/HeroCarousel";

export type HomeData = {
  nav: NavModel;
  newArrivals: Product[];
  bestSellers: Product[];
  onSale: Product[];
  personalized: Product[];
};

export const getHomeData = cache(async (): Promise<HomeData> => {
  const nav = await getNavModel();
  const [newArrivals, bestSellers, onSale, personalized] = await Promise.all([
    queryProducts({ sort: "newest", pageSize: 8 }).then((r) => r.products),
    nav.hasBestSellers ? getBestSellers(8) : Promise.resolve([]),
    nav.facets.hasOnSale ? queryProducts({ onSale: true, pageSize: 12 }).then((r) => r.products.filter((p) => discountPercent(p) !== null).slice(0, 8)) : Promise.resolve([]),
    nav.hasPersonalized ? queryProducts({ customizable: true, pageSize: 8 }).then((r) => r.products) : Promise.resolve([]),
  ]);
  return { nav, newArrivals, bestSellers, onSale, personalized };
});

const photo = (p?: Product) => (p?.images[0] ? { src: p.images[0].src, alt: p.images[0].alt || p.name } : undefined);

/**
 * The hero campaigns. Copy is ShilpiKala's own; every image is a real
 * product photo and every claim (a sale, personalised items) appears
 * only when the catalogue backs it up.
 */
export function buildHeroSlides(data: HomeData): HeroSlide[] {
  const { nav } = data;
  const category = (needle: string) => nav.categories.find((c) => c.slug.includes(needle));
  const firstPhoto = [...data.newArrivals, ...data.bestSellers].find((p) => p.images.length > 0);
  const slides: HeroSlide[] = [];

  slides.push({
    id: "handmade",
    eyebrow: "Art · Soul · Craft",
    title: "Handmade with Love",
    text: "Every piece is made by hand, one at a time, before it reaches your wall.",
    cta: { label: "Shop the collection", href: "/shop" },
    ...(photo(firstPhoto) ? { image: photo(firstPhoto) } : {}),
  });

  const mandala = category("mandala");
  if (mandala) {
    slides.push({
      id: "mandala",
      eyebrow: mandala.name,
      title: "Discover the Beauty of Mandala Art",
      text: "Symmetry and circular geometry, drawn one fine line at a time.",
      cta: { label: `Shop ${mandala.name}`, href: `/categories/${mandala.slug}` },
      ...(mandala.coverImage ? { image: { src: mandala.coverImage, alt: `${mandala.name} from ShilpiKala` } } : {}),
    });
  }

  const lipan = category("lipan");
  if (lipan) {
    slides.push({
      id: "lipan",
      eyebrow: lipan.name,
      title: "Traditional Lipan Art for Modern Homes",
      text: "Terracotta relief and mirror work rooted in traditional craft.",
      cta: { label: `Shop ${lipan.name}`, href: `/categories/${lipan.slug}` },
      ...(lipan.coverImage ? { image: { src: lipan.coverImage, alt: `${lipan.name} from ShilpiKala` } } : {}),
    });
  }

  const best = data.onSale.reduce<{ pct: number; product?: Product }>((acc, p) => {
    const pct = discountPercent(p) ?? 0;
    return pct > acc.pct ? { pct, product: p } : acc;
  }, { pct: 0 });
  if (best.product) {
    slides.push({
      id: "sale",
      eyebrow: "On sale now",
      title: `Up to ${best.pct}% off selected pieces`,
      text: "Reduced prices on handmade pieces while stock lasts.",
      cta: { label: "Shop the sale", href: "/shop?sale=1" },
      ...(photo(best.product) ? { image: photo(best.product) } : {}),
    });
  }

  if (nav.hasPersonalized) {
    slides.push({
      id: "personalised",
      eyebrow: "Made for you",
      title: "Personalized Gifts for Every Occasion",
      text: "Pieces we can make to your name, palette and space.",
      cta: { label: "Shop personalised gifts", href: "/shop?custom=1" },
      ...(photo(data.personalized[0]) ? { image: photo(data.personalized[0]) } : {}),
    });
  } else {
    slides.push({
      id: "custom",
      eyebrow: "Commission a piece",
      title: "Art made just for you",
      text: "Tell us your space, palette and story — we will make it by hand.",
      cta: { label: "Start a custom request", href: "/custom-art" },
    });
  }
  return slides;
}
