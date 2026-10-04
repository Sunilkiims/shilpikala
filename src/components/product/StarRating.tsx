type StarRatingProps = {
  rating: number;
  className?: string;
};

export function StarRating({ rating, className }: StarRatingProps) {
  const rounded = Math.round(rating);

  return (
    <div
      className={className}
      role="img"
      aria-label={`${rating.toFixed(1)} out of 5 stars`}
    >
      <span aria-hidden="true" className="text-terracotta">
        {"★".repeat(rounded)}
        <span className="text-earth-brown/25">{"★".repeat(5 - rounded)}</span>
      </span>
    </div>
  );
}
