import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductGrid } from "@/components/product/ProductGrid";
import { AddToCartForm } from "@/components/cart/AddToCartForm";
import { WishlistButton } from "@/components/wishlist/WishlistButton";
import { ReviewsSection } from "@/components/product/ReviewsSection";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildBreadcrumbSchema, buildProductSchema } from "@/lib/seo/structuredData";
import { PriceTag } from "@/components/product/PriceTag";
import { priceDisplay } from "@/lib/offers/display";
import { getReviewsByProductId } from "@/lib/reviews/store";
import { returnWindowDays } from "@/lib/returns/config";
import { getProductPolicy } from "@/lib/returns/store";
import {
  getAllProducts,
  getProductBySlug,
  getProductsByCategorySlug,
} from "@/lib/catalog";

// Re-read at most a minute after a request, so products and scheduled offers
// (which start and end on a clock) show up without a redeploy. Admin edits refresh sooner.
export const revalidate = 60;

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
  const display = priceDisplay(product);
  const [relatedCandidates, approvedReviews, returnPolicy] = await Promise.all([
    primaryCategory ? getProductsByCategorySlug(primaryCategory.slug) : [],
    getReviewsByProductId(product.id, "approved"),
    getProductPolicy(product.id),
  ]);
  const related = relatedCandidates
    .filter((candidate) => candidate.id !== product.id)
    .slice(0, 4);

  const breadcrumbItems = [
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
  ];

  return (
    <Container className="py-12 sm:py-16">
      <JsonLd data={buildProductSchema(product, approvedReviews)} />
      <JsonLd data={buildBreadcrumbSchema(breadcrumbItems)} />

      <Breadcrumbs items={breadcrumbItems} />

      <div className="mt-8 grid gap-10 md:grid-cols-2 md:gap-14">
        <ProductGallery product={product} className="rounded-sm" />

        <div>
          {primaryCategory && (
            <p className="text-xs tracking-wide text-earth-brown/70">
              {primaryCategory.name}
            </p>
          )}

          <h1 className="mt-2 text-3xl text-charcoal sm:text-4xl">
            {product.name}
          </h1>

          <PriceTag
            className="mt-4"
            size="detail"
            price={display.price}
            original={display.original}
            percentOff={display.percentOff}
            badge={display.badge}
          />

          <p className="mt-6 max-w-md text-base leading-relaxed text-earth-brown/80">
            {product.description}
          </p>

          <div className="mt-8">
            {product.inStock ? (
              <AddToCartForm product={product} />
            ) : (
              <p className="text-sm text-earth-brown/70">
                Currently out of stock.
              </p>
            )}
          </div>

          <div className="mt-5">
            <WishlistButton productId={product.id} productName={product.name} />
          </div>

          <p className="mt-6 max-w-md text-xs leading-relaxed text-earth-brown/75">
            {returnPolicy.returnable || returnPolicy.replaceable
              ? `Damaged or not as described? ${returnPolicy.returnable ? "Returns" : "Replacements"}${returnPolicy.returnable && returnPolicy.replaceable ? " and replacements" : ""} within ${returnWindowDays()} days of delivery.`
              : "This piece is made to order and is not eligible for returns or replacements. Your statutory rights are unaffected."}{" "}
            <Link href="/return-refund-policy" className="text-terracotta underline underline-offset-2 hover:text-terracotta-deep">
              Return &amp; refund policy
            </Link>
          </p>
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

      <ReviewsSection productId={product.id} reviews={approvedReviews} />
    </Container>
  );
}
