import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { ProductGrid } from "@/components/product/ProductGrid";
import { getAllProducts } from "@/lib/catalog";
import { getAd } from "@/lib/ads/store";
import { computeStatus } from "@/lib/ads/types";

export const revalidate = 60;
export const metadata: Metadata = { title: "Special offers", robots: { index: false, follow: true } };
type Props = { params: Promise<{ id: string }> };

/** The product list behind a "several hand-picked products" promotion. Only exists while that promotion is live. */
export default async function PromotionPage({ params }: Props) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  const ad = await getAd(id);
  if (!ad || computeStatus(ad) !== "active" || ad.destType !== "products") notFound();
  const byId = new Map((await getAllProducts()).map((p) => [p.id, p]));
  const products = ad.destProductIds.map((i) => byId.get(i)).filter((p) => p !== undefined);
  if (products.length === 0) notFound();
  const title = ad.heading ?? ad.name;
  return (
    <Container className="py-12 sm:py-16">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Shop", href: "/shop" }, { label: title }]} />
      <div className="mt-6"><SectionHeading title={title} description={ad.subtitle} /></div>
      <div className="mt-10"><ProductGrid products={products} /></div>
    </Container>
  );
}
