import { FeaturedProducts } from "@/components/sections/FeaturedProducts";
import { CategoryPreview } from "@/components/sections/CategoryPreview";
import { BrandStatement } from "@/components/sections/BrandStatement";
import { HeroAds, HomeCarousels, HomeCategoryAds } from "@/components/ads/HomeAds";

// Admin changes refresh this page immediately. This timer is what makes scheduled
// campaigns start and expire on time without anyone touching the admin: a promotion
// appears or disappears within a minute of its start/end time.
export const revalidate = 60;

export default function Home() {
  return (
    <>
      <h1 className="sr-only">ShilpiKala — handmade Mandala Art and Lipan Art</h1>
      <HeroAds />
      <HomeCarousels part="first" />
      <HomeCategoryAds />
      <HomeCarousels part="rest" />
      <FeaturedProducts />
      <CategoryPreview />
      <BrandStatement />
    </>
  );
}
