import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { ReviewModerationActions } from "@/components/admin/ReviewModerationActions";
import { getAllReviews } from "@/lib/reviews/store";
import { getAllProducts } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Reviews — Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium" });
}

export default async function AdminReviewsPage() {
  const [reviews, products] = await Promise.all([getAllReviews(), getAllProducts()]);
  const productNames = new Map(products.map((p) => [p.id, p.name]));
  const pendingCount = reviews.filter((r) => r.status === "pending").length;

  return (
    <Container className="py-12 sm:py-16">
      <h1 className="text-3xl text-charcoal">Reviews</h1>
      <p className="mt-2 text-sm text-earth-brown/70">
        {reviews.length} total · {pendingCount} pending
      </p>

      {reviews.length === 0 ? (
        <p className="mt-12 text-sm text-earth-brown/70">No reviews yet.</p>
      ) : (
        <ul className="mt-10 divide-y divide-earth-brown/15 border-y border-earth-brown/15">
          {reviews.map((review) => (
            <li key={review.id} className="py-6">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <p className="text-sm text-charcoal">
                  {productNames.get(review.productId) ?? `Product #${review.productId}`}
                  <span className="text-earth-brown/60">
                    {" "}
                    — {"★".repeat(review.rating)}
                    {"☆".repeat(5 - review.rating)} by {review.authorName}
                  </span>
                </p>
                <p className="text-xs text-earth-brown/55">
                  {statusLabel[review.status]} · {formatDate(review.createdAt)}
                </p>
              </div>

              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-earth-brown/80">
                {review.content}
              </p>

              <p className="mt-3 text-xs text-earth-brown/50">
                {review.customerEmail} · order {review.orderId}
              </p>

              <div className="mt-4">
                <ReviewModerationActions reviewId={review.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
