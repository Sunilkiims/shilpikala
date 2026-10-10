import { Hero } from "@/components/sections/Hero";
import { FeaturedProducts } from "@/components/sections/FeaturedProducts";
import { CategoryPreview } from "@/components/sections/CategoryPreview";
import { BrandStatement } from "@/components/sections/BrandStatement";

// Admin changes refresh this page immediately; this is only a safety net.
export const revalidate = 300;

export default function Home() {
  return (
    <>
      <Hero />
      <FeaturedProducts />
      <CategoryPreview />
      <BrandStatement />
    </>
  );
}
