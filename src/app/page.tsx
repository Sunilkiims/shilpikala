import { CategoryStrip } from "@/components/sections/CategoryStrip";
import { OfferStrip } from "@/components/sections/OfferStrip";
import { PicksSection } from "@/components/sections/PicksSection";
import { FeaturedProducts } from "@/components/sections/FeaturedProducts";
import { CategoryPreview } from "@/components/sections/CategoryPreview";
import { BrandStatement } from "@/components/sections/BrandStatement";
import { HomeSearch } from "@/components/home/HomeSearch";
import { getAllProducts } from "@/lib/catalog";
import { toBrowseProduct } from "@/lib/browse/types";
import {
  HeroAds,
  HomeCarousels,
  HomeCategoryAds,
} from "@/components/ads/HomeAds";

// Admin changes refresh this page immediately. This timer is what makes scheduled
// campaigns start and expire on time without anyone touching the admin: a promotion
// appears or disappears within a minute of its start/end time.
export const revalidate = 60;

export default async function Home() {
  const searchable = (await getAllProducts()).map(toBrowseProduct);
  return (
    <HomeSearch products={searchable} strip={<CategoryStrip />}>
      <h1 className="sr-only">
        ShilpiKala — handmade Mandala Art and Lipan Art
      </h1>
      <HeroAds />
      <OfferStrip />
      <HomeCarousels part="first" />
      <PicksSection />
      <HomeCategoryAds />
      <HomeCarousels part="rest" />
      <FeaturedProducts />
      <CategoryPreview />
      <BrandStatement />
    </HomeSearch>
  );
}
