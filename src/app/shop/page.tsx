import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { ShopBrowser } from "@/components/product/ShopBrowser";
import { products } from "@/data/products";
import { categories } from "@/data/categories";

export const metadata: Metadata = buildMetadata({
  title: "Shop",
  description: "Browse the full ShilpiKala collection of mandala, Lipan and handmade art.",
  path: "/shop",
});

export default function ShopPage() {
  return (
    <Container className="py-12 sm:py-16">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Shop" }]} />

      <div className="mt-6">
        <SectionHeading
          title="Shop the collection"
          description="Every piece is made by hand. Filter by category to find yours."
        />
      </div>

      <div className="mt-10">
        <ShopBrowser products={products} categories={categories} />
      </div>
    </Container>
  );
}
