import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { CollectionManager } from "@/components/admin/ads/CollectionManager";
import { loadAdFormData } from "@/lib/ads/formData";
import { listCollections } from "@/lib/ads/store";

export const metadata: Metadata = { title: "Collections — Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
  const [collections, { products }] = await Promise.all([listCollections(), loadAdFormData()]);
  return (
    <Container className="py-10 sm:py-14">
      <p className="text-sm"><Link href="/admin/ads" className="text-terracotta underline underline-offset-2">← Ads &amp; Promotions</Link></p>
      <h1 className="mt-2 text-3xl text-charcoal">Collections</h1>
      <p className="mt-2 max-w-xl text-sm text-earth-brown/75">Hand-picked groups of products with their own page. Use them as the destination of a banner or as the product source of a carousel.</p>
      <div className="mt-8"><CollectionManager collections={collections} products={products} /></div>
    </Container>
  );
}
