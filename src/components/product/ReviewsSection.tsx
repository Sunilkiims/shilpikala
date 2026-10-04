import { getReviewsByProductId } from "@/lib/reviews/store";
import { StarRating } from "@/components/product/StarRating";
import { ReviewForm } from "@/components/product/ReviewForm";

type ReviewsSectionProps = {
  productId: number;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium" });
}

export async function ReviewsSection({ productId }: ReviewsSectionProps) {
  const reviews = await getReviewsByProductId(productId, "approved");
  const average =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

  return (
    <div className="mt-20 border-t border-earth-brown/15 pt-12">
      <h2 className="text-2xl text-charcoal">Reviews</h2>
      {reviews.length > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <StarRating rating={average} />
          <span className="text-sm text-earth-brown/70">
            {average.toFixed(1)} ({reviews.length}{" "}
            {reviews.length === 1 ? "review" : "reviews"})
          </span>
        </div>
      )}

      {reviews.length === 0 ? (
        <p className="mt-8 text-sm text-earth-brown/70">
          No reviews yet — be the first to write one.
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-earth-brown/15 border-t border-earth-brown/15">
          {reviews.map((review) => (
            <li key={review.id} className="py-6">
              <div className="flex items-center justify-between">
                <StarRating rating={review.rating} />
                <span className="text-xs text-earth-brown/55">
                  {formatDate(review.createdAt)}
                </span>
              </div>
              <p className="mt-2 text-sm text-charcoal">{review.authorName}</p>
              <p className="mt-2 text-sm leading-relaxed text-earth-brown/80">
                {review.content}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8">
        <ReviewForm productId={productId} />
      </div>
    </div>
  );
}
