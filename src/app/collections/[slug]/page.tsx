import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { ProductGrid } from "@/components/product/ProductGrid";
import { getAllProducts } from "@/lib/catalog";
import { getCollectionBySlug } from "@/lib/ads/store";

export const revalidate = 60;
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = await getCollectionBySlug(slug);
  return buildMetadata({ title: c?.name ?? "Collection", description: c?.description, path: `/collections/${slug}` });
}

export default async function CollectionPage({ params }: Props) {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);
  if (!collection) notFound();
  const byId = new Map((await getAllProducts()).map((p) => [p.id, p]));
  const products = collection.productIds.map((id) => byId.get(id)).filter((p) => p !== undefined);
  const crumbs = [{ label: "Home", href: "/" }, { label: "Shop", href: "/shop" }, { label: collection.name }];

  return (
    <Container className="py-12 sm:py-16">
      <Breadcrumbs items={crumbs} />
      <div className="mt-6"><SectionHeading title={collection.name} description={collection.description} /></div>
      <div className="mt-10">
        <ProductGrid products={products} emptyMessage="Nothing in this collection yet — check back soon." />
      </div>
    </Container>
  );
}
