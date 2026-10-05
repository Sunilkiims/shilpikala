import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { WishlistView } from "@/components/wishlist/WishlistView";
import { getAllProducts } from "@/lib/catalog";

export const revalidate = 300;

export const metadata: Metadata = buildMetadata({
  title: "Wishlist",
  description: "Pieces you've saved to come back to.",
  path: "/wishlist",
});

export default async function WishlistPage() {
  const products = await getAllProducts();

  return (
    <Container className="py-12 sm:py-16">
      <SectionHeading title="Your wishlist" />
      <div className="mt-10">
        <WishlistView products={products} />
      </div>
    </Container>
  );
}
