import type { Product } from "@/types/catalog";
import type { StoredReview } from "@/lib/reviews/types";
import type { Crumb } from "@/components/navigation/Breadcrumbs";
import { siteConfig } from "@/lib/config/site";

/**
 * Plain JSON-LD objects (schema.org). Kept as small pure builder
 * functions — no components here — so each page decides what to
 * attach and pages that don't need structured data pay no cost.
 */

export function buildOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    sameAs: siteConfig.social.map((link) => link.href),
  };
}

export function buildWebSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.url,
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteConfig.url}/shop?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function buildBreadcrumbSchema(items: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: `${siteConfig.url}${item.href}` } : {}),
    })),
  };
}

export function buildProductSchema(
  product: Product,
  approvedReviews: StoredReview[]
) {
  const unitPrice =
    product.pricing?.price ?? (product.onSale && product.salePrice ? product.salePrice : product.price);

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription ?? product.description,
    sku: String(product.id),
    url: `${siteConfig.url}/product/${product.slug}`,
    offers: {
      "@type": "Offer",
      url: `${siteConfig.url}/product/${product.slug}`,
      priceCurrency: "INR",
      price: unitPrice,
      availability: product.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };

  if (product.images[0]) {
    schema.image = `${siteConfig.url}${product.images[0].src}`;
  }

  // Never fabricate a rating — omit entirely when there are no
  // approved reviews, exactly matching what's visible on the page.
  if (approvedReviews.length > 0) {
    const average =
      approvedReviews.reduce((sum, r) => sum + r.rating, 0) / approvedReviews.length;

    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(average.toFixed(1)),
      reviewCount: approvedReviews.length,
    };

    schema.review = approvedReviews.slice(0, 10).map((review) => ({
      "@type": "Review",
      author: { "@type": "Person", name: review.authorName },
      datePublished: review.createdAt.slice(0, 10),
      reviewBody: review.content,
      reviewRating: {
        "@type": "Rating",
        ratingValue: review.rating,
        bestRating: 5,
        worstRating: 1,
      },
    }));
  }

  return schema;
}
