/**
 * Caching for files that are served out of the database by id (product photos, ad banners).
 * An id is never reused and its bytes never change, so a copy can be kept forever, both in the
 * visitor's browser and in Vercel's CDN. The CDN header is set explicitly so the copy is shared
 * by every visitor instead of each request reading the file out of the database again.
 */
export const etagFor = (kind: string, id: number) => `"${kind}-${id}"`;

const IMMUTABLE = "public, max-age=31536000, immutable";

/** A 304 when the browser already has this file; answered without touching the database. */
export function notModifiedResponse(
  request: Request,
  etag: string,
): Response | undefined {
  const inm = request.headers.get("if-none-match");
  if (!inm) return undefined;
  const matches = inm
    .split(",")
    .some((t) => t.trim().replace(/^W\//, "") === etag);
  if (!matches) return undefined;
  return new Response(null, {
    status: 304,
    headers: {
      ETag: etag,
      "Cache-Control": IMMUTABLE,
      "Vercel-CDN-Cache-Control": "max-age=31536000",
    },
  });
}

export function immutableFileResponse(
  data: Uint8Array,
  mime: string,
  etag: string,
): Response {
  return new Response(data as BodyInit, {
    headers: {
      "Content-Type": mime,
      "Cache-Control": IMMUTABLE,
      "Vercel-CDN-Cache-Control": "max-age=31536000",
      ETag: etag,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
