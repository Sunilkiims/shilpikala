"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { StarRatingInput } from "@/components/product/StarRatingInput";

type ReviewFormProps = {
  productId: number;
};

const fieldClass =
  "mt-1.5 w-full border border-earth-brown/25 bg-transparent px-3 py-2.5 text-sm text-charcoal outline-none focus-visible:border-terracotta";

type Status = "idle" | "submitting" | "success" | "error" | "rate_limited";

const ERROR_MESSAGES: Record<string, string> = {
  verification_failed:
    "We couldn't match that order reference and email to a purchase of this product.",
  already_reviewed: "You've already reviewed this product for that order.",
  content_too_short: "Please write a little more — at least a few words.",
  name_required: "Please enter a name to display with your review.",
  invalid_rating: "Please choose a star rating.",
};

export function ReviewForm({ productId }: ReviewFormProps) {
  const [open, setOpen] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [email, setEmail] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("submitting");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: orderId.trim(),
          email: email.trim(),
          productId,
          rating,
          content,
          authorName,
        }),
      });

      if (response.status === 429) {
        setStatus("rate_limited");
        return;
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setStatus("error");
        setErrorMessage(
          ERROR_MESSAGES[data.error] ??
            "We couldn't submit that review. Please check the details and try again."
        );
        return;
      }

      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMessage("Something went wrong. Please try again.");
    }
  }

  if (status === "success") {
    return (
      <p className="text-sm text-earth-brown/80">
        Thanks — your review has been submitted and will appear here once
        it&apos;s approved.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-terracotta hover:text-terracotta-deep"
      >
        Write a review
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid max-w-sm gap-4">
      <p className="text-xs text-earth-brown/60">
        Reviews are limited to verified purchases — enter the order reference
        and email from your confirmation.
      </p>

      <label className="block">
        <span className="text-sm text-earth-brown/80">Order reference</span>
        <input
          className={fieldClass}
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          required
        />
      </label>
      <label className="block">
        <span className="text-sm text-earth-brown/80">Email</span>
        <input
          type="email"
          className={fieldClass}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>
      <label className="block">
        <span className="text-sm text-earth-brown/80">Display name</span>
        <input
          className={fieldClass}
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          required
        />
      </label>

      <div>
        <span className="text-sm text-earth-brown/80">Rating</span>
        <div className="mt-1.5">
          <StarRatingInput value={rating} onChange={setRating} />
        </div>
      </div>

      <label className="block">
        <span className="text-sm text-earth-brown/80">Review</span>
        <textarea
          className={fieldClass}
          rows={4}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
        />
      </label>

      {status === "error" && errorMessage && (
        <p className="text-sm text-terracotta-deep" role="alert">
          {errorMessage}
        </p>
      )}
      {status === "rate_limited" && (
        <p className="text-sm text-terracotta-deep" role="alert">
          Too many attempts. Please wait a few minutes and try again.
        </p>
      )}

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={status === "submitting" || rating === 0}>
          {status === "submitting" ? "Submitting…" : "Submit Review"}
        </Button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-earth-brown/60 hover:text-terracotta"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
