import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/security/getClientIp";
import { isRateLimited, recordAttempt, secondsUntilReset } from "@/lib/security/rateLimiter";

/** Counts the attempt and returns a 429 response if the bucket is full. */
export function limitAttempts(
  request: Request,
  bucket: string,
  limit: number,
  windowMs: number
): NextResponse | null {
  const key = `${bucket}:${getClientIp(request)}`;
  if (isRateLimited(key, limit, windowMs)) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(secondsUntilReset(key, windowMs)) } }
    );
  }
  recordAttempt(key, windowMs);
  return null;
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
