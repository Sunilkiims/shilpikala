/**
 * Works for both middleware (NextRequest extends Request) and Route
 * Handlers (plain Request) since it only reads headers. Behind a
 * reverse proxy or host like Vercel, x-forwarded-for is set reliably;
 * "unknown" is a safe fallback that just shares one rate-limit bucket
 * across any request where it's genuinely missing, rather than throwing.
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}
