/**
 * In-memory, fixed-window rate limiter. Deliberately simple, matching
 * this project's other lightweight-by-default choices (file-based
 * storage, etc.): it protects a single Node process well, but resets
 * on restart and isn't shared across multiple server instances. Fine
 * for this project's scale; swap for a shared store (Redis, etc.) if
 * you ever run more than one instance behind a load balancer.
 */

type Bucket = {
  count: number;
  windowStart: number;
};

const buckets = new Map<string, Bucket>();

// Opportunistic cleanup so the map doesn't grow unbounded under abuse
// from many different IPs — runs every so often rather than on a timer,
// so it costs nothing when the app is idle.
let checksSinceCleanup = 0;
function maybeCleanup(windowMs: number) {
  checksSinceCleanup += 1;
  if (checksSinceCleanup < 500) return;
  checksSinceCleanup = 0;

  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > windowMs) buckets.delete(key);
  }
}

/**
 * Returns true if `key` has already hit `limit` attempts within the
 * current `windowMs` window. Does not itself count as an attempt —
 * call `recordAttempt` separately for whichever requests should count
 * (e.g. only failed logins, not successful ones).
 */
export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  maybeCleanup(windowMs);
  const bucket = buckets.get(key);
  if (!bucket) return false;
  if (Date.now() - bucket.windowStart > windowMs) return false;
  return bucket.count >= limit;
}

/** Records one attempt against `key`, starting a fresh window if needed. */
export function recordAttempt(key: string, windowMs: number): void {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart > windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
  } else {
    bucket.count += 1;
  }
}

/** Seconds until `key`'s current window resets — for a Retry-After header. */
export function secondsUntilReset(key: string, windowMs: number): number {
  const bucket = buckets.get(key);
  if (!bucket) return 0;
  return Math.max(0, Math.ceil((bucket.windowStart + windowMs - Date.now()) / 1000));
}

/** Test-only: clears all buckets so tests don't leak state into each other. */
export function __resetRateLimiterForTests(): void {
  buckets.clear();
}
