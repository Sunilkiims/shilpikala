import sharp from "sharp";

export const MAX_PHOTO_EDGE = 1600;

export type OptimizedImage = { data: Buffer; mime: string; optimized: boolean };

/**
 * Shrinks an uploaded product photo before it is stored in the database. Phone photos are often
 * 3 to 5 MB; every time one is read back out of PostgreSQL it counts against the host's data
 * transfer allowance (Neon's free plan allows 5 GB a month), so storing a 1600px WebP of about
 * 100 to 300 KB instead cuts that traffic by 90% or more with no visible difference.
 *
 * Animated GIFs are left exactly as uploaded (re-encoding would stop them animating), and if the
 * file can't be processed or would come out larger, the original bytes are stored unchanged.
 */
export async function optimizeProductPhoto(
  data: Buffer,
  mime: string,
): Promise<OptimizedImage> {
  const original: OptimizedImage = { data, mime, optimized: false };
  if (mime === "image/gif") return original;
  try {
    const out = await sharp(data, { failOn: "none" })
      .rotate() // honour the camera's orientation flag, then drop it
      .resize({
        width: MAX_PHOTO_EDGE,
        height: MAX_PHOTO_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();
    if (out.length === 0 || out.length >= data.length) return original;
    return { data: out, mime: "image/webp", optimized: true };
  } catch {
    return original;
  }
}
