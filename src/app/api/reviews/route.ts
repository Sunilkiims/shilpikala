import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getOrderById } from "@/lib/orders/store";
import {
  appendReview,
  hasReviewForOrderAndProduct,
} from "@/lib/reviews/store";
import { validateReviewFields } from "@/lib/reviews/validation";
import { getClientIp } from "@/lib/security/getClientIp";
import {
  isRateLimited,
  recordAttempt,
  secondsUntilReset,
} from "@/lib/security/rateLimiter";

const SUBMIT_LIMIT = 10;
const SUBMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Only accepts a review when orderId + email match a real paid order
 * that actually contains the given product — the same verification
 * shape as /api/track-order. Every submission starts as "pending" and
 * only becomes visible once approved in /admin/reviews.
 */
export async function POST(request: Request) {
  const rateLimitKey = `reviews:${getClientIp(request)}`;
  if (isRateLimited(rateLimitKey, SUBMIT_LIMIT, SUBMIT_WINDOW_MS)) {
    return NextResponse.json(
      { error: "rate_limited" },
      {
        status: 429,
        headers: {
          "Retry-After": String(secondsUntilReset(rateLimitKey, SUBMIT_WINDOW_MS)),
        },
      }
    );
  }
  recordAttempt(rateLimitKey, SUBMIT_WINDOW_MS);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = validateReviewFields(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { orderId, email, productId, rating, content, authorName } = parsed.value;

  const order = await getOrderById(orderId);
  const verified =
    order &&
    order.customerEmail.toLowerCase() === email.toLowerCase() &&
    order.items.some((item) => item.productId === productId);

  // Same generic response whether the order doesn't exist, the email
  // doesn't match, or the order didn't include this product — never
  // reveals which, matching /api/track-order's approach.
  if (!verified) {
    return NextResponse.json({ error: "verification_failed" }, { status: 403 });
  }

  const alreadyReviewed = await hasReviewForOrderAndProduct(orderId, productId);
  if (alreadyReviewed) {
    return NextResponse.json({ error: "already_reviewed" }, { status: 409 });
  }

  await appendReview({
    id: randomUUID(),
    productId,
    orderId,
    customerEmail: email,
    authorName,
    rating,
    content,
    status: "pending",
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ submitted: true }, { status: 201 });
}
