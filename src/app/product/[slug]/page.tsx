import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductGrid } from "@/components/product/ProductGrid";
import { AddToCartForm } from "@/components/cart/AddToCartForm";
import { WishlistButton } from "@/components/wishlist/WishlistButton";
import { ReviewsSection } from "@/components/product/ReviewsSection";
import { formatPrice } from "@/lib/utils/currency";
import {
  getAllProducts,
  getProductBySlug,
  getProductsByCategorySlug,
} from "@/lib/catalog";

// Re-read on each request after the first 5 minutes, so products added
// or edited in the admin area show up without a redeploy.
export const revalidate = 300;

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const products = await getAllProducts();
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  return buildMetadata({
    title: product?.name ?? "Product",
    description: product?.shortDescription,
    path: `/product/${slug}`,
  });
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const primaryCategory = product.categories[0];
  const relatedCandidates = primaryCategory
    ? await getProductsByCategorySlug(primaryCategory.slug)
    : [];
  const related = relatedCandidates
    .filter((candidate) => candidate.id !== product.id)
    .slice(0, 4);

  return (
    <Container className="py-12 sm:py-16">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Shop", href: "/shop" },
          ...(primaryCategory
            ? [
                {
                  label: primaryCategory.name,
                  href: `/categories/${primaryCategory.slug}`,
                },
              ]
            : []),
          { label: product.name },
        ]}
      />

      <div className="mt-8 grid gap-10 md:grid-cols-2 md:gap-14">
        <ProductGallery product={product} className="rounded-sm" />

        <div>
          {primaryCategory && (
            <p className="text-xs tracking-wide text-earth-brown/55">
              {primaryCategory.name}
            </p>
          )}

          <h1 className="mt-2 text-3xl text-charcoal sm:text-4xl">
            {product.name}
          </h1>

          <div className="mt-4 flex items-center gap-3">
            {product.onSale && product.salePrice ? (
              <>
                <span className="text-xl text-terracotta">
                  {formatPrice(product.salePrice)}
                </span>
                <span className="text-base text-earth-brown/50 line-through">
                  {formatPrice(product.regularPrice)}
                </span>
              </>
            ) : (
              <span className="text-xl text-earth-brown/90">
                {formatPrice(product.price)}
              </span>
            )}
          </div>

          <p className="mt-6 max-w-md text-base leading-relaxed text-earth-brown/80">
            {product.description}
          </p>

          <div className="mt-8">
            {product.inStock ? (
              <AddToCartForm product={product} />
            ) : (
              <p className="text-sm text-earth-brown/60">
                Currently out of stock.
              </p>
            )}
          </div>

          <div className="mt-5">
            <WishlistButton productId={product.id} productName={product.name} />
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <div className="mt-20 border-t border-earth-brown/15 pt-12">
          <h2 className="text-2xl text-charcoal">You may also like</h2>
          <div className="mt-8">
            <ProductGrid products={related} />
          </div>
        </div>
      )}

      <ReviewsSection productId={product.id} />
    </Container>
  );
}
