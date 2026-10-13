import { HeroCarousel } from "@/components/ads/HeroCarousel";
import { ProductCarousel } from "@/components/ads/ProductCarousel";
import { BannerSlide } from "@/components/ads/BannerSlide";
import { Container } from "@/components/ui/Container";
import { getLiveRenderableAds, type RenderableAd } from "@/lib/ads/public";
import { getSettings } from "@/lib/ads/store";

/** A failure in the ads system must never take the page down: these render nothing instead. */
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch (error) { console.error("[ads] could not load promotions:", (error as Error).message); return fallback; }
}

export async function HeroAds() {
  const [ads, settings] = await Promise.all([safe(() => getLiveRenderableAds("home_hero"), []), safe(getSettings, { heroAutoplay: true, heroIntervalSeconds: 6 })]);
  if (ads.length === 0) return null;
  return <HeroCarousel slides={ads} autoplay={settings.heroAutoplay} intervalSeconds={settings.heroIntervalSeconds} />;
}

function Carousels({ ads, embedded }: { ads: RenderableAd[]; embedded?: boolean }) {
  return ads.map((ad) => (
    <ProductCarousel
      key={ad.id} heading={ad.heading} subtitle={ad.subtitle} badge={ad.badge} products={ad.products ?? []}
      showDiscount={ad.showDiscount} viewAllHref={ad.href} viewAllExternal={ad.external}
      banner={{ desktop: ad.desktop, mobile: ad.mobile }} embedded={embedded}
    />
  ));
}

/** The first product carousel sits right under the hero; the rest follow the category promotions. */
export async function HomeCarousels({ part }: { part: "first" | "rest" }) {
  const ads = await safe(() => getLiveRenderableAds("home_carousel"), []);
  return <Carousels ads={part === "first" ? ads.slice(0, 1) : ads.slice(1)} />;
}

export function PromoBanners({ ads, embedded }: { ads: RenderableAd[]; embedded?: boolean }) {
  if (ads.length === 0) return null;
  const grid = (
    <div className={`grid gap-4 ${ads.length > 1 ? "md:grid-cols-2" : ""}`}>
      {ads.map((ad, i) => (
        <BannerSlide key={ad.id} ad={ad} headingLevel="h3" eager={false} className={ads.length % 2 === 1 && i === 0 && ads.length > 1 ? "md:col-span-2" : undefined} />
      ))}
    </div>
  );
  if (embedded) return <section aria-label="Promotions" className="mb-8">{grid}</section>;
  return (
    <section aria-label="Promotions" className="border-t border-earth-brown/15 py-10 sm:py-14">
      <Container>{grid}</Container>
    </section>
  );
}

export async function HomeCategoryAds() {
  return <PromoBanners ads={await safe(() => getLiveRenderableAds("home_category"), [])} />;
}

/** Promotions placed on one category page. `top` = banners above the products, `bottom` = carousels below. */
export async function CategoryPageAds({ categoryId, position }: { categoryId: number; position: "top" | "bottom" }) {
  const ads = await safe(() => getLiveRenderableAds("category_page", categoryId), []);
  if (position === "top") return <PromoBanners embedded ads={ads.filter((a) => a.type !== "carousel")} />;
  return <Carousels embedded ads={ads.filter((a) => a.type === "carousel")} />;
}
