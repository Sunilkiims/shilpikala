import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { MAX_PHOTO_EDGE, optimizeProductPhoto } from "@/lib/media/optimize";

/** A large, noisy picture like a phone photo (noise compresses badly, so it is a fair worst case). */
async function bigPhoto(width: number, height: number, format: "jpeg" | "png") {
  const raw = Buffer.alloc(width * height * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 2654435761) >>> 24;
  const img = sharp(raw, { raw: { width, height, channels: 3 } });
  return format === "jpeg"
    ? img.jpeg({ quality: 95 }).toBuffer()
    : img.png().toBuffer();
}

describe("optimizeProductPhoto", () => {
  it("shrinks a large JPEG to at most 1600px WebP and far fewer bytes", async () => {
    const input = await bigPhoto(3000, 2000, "jpeg");
    const out = await optimizeProductPhoto(input, "image/jpeg");
    expect(out.optimized).toBe(true);
    expect(out.mime).toBe("image/webp");
    expect(out.data.length).toBeLessThan(input.length / 2);
    const meta = await sharp(out.data).metadata();
    expect(meta.format).toBe("webp");
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(
      MAX_PHOTO_EDGE,
    );
    expect(meta.width! / meta.height!).toBeCloseTo(1.5, 1); // aspect ratio kept
  });

  it("keeps transparency when converting a PNG", async () => {
    const input = await sharp({
      create: {
        width: 2400,
        height: 2400,
        channels: 4,
        background: { r: 200, g: 50, b: 20, alpha: 0.5 },
      },
    })
      .png({ compressionLevel: 0 })
      .toBuffer();
    const out = await optimizeProductPhoto(input, "image/png");
    expect(out.mime).toBe("image/webp");
    expect((await sharp(out.data).metadata()).hasAlpha).toBe(true);
  });

  it("never enlarges a small image", async () => {
    const input = await sharp({
      create: { width: 400, height: 300, channels: 3, background: "#c46a3a" },
    })
      .png({ compressionLevel: 0 })
      .toBuffer();
    const out = await optimizeProductPhoto(input, "image/png");
    const meta = await sharp(out.data).metadata();
    expect(meta.width).toBe(400);
    expect(meta.height).toBe(300);
  });

  it("leaves an animated GIF exactly as uploaded", async () => {
    const gif = Buffer.from(
      "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
      "base64",
    );
    const out = await optimizeProductPhoto(gif, "image/gif");
    expect(out.optimized).toBe(false);
    expect(out.data).toBe(gif);
  });

  it("falls back to the original bytes when the file can't be decoded", async () => {
    const junk = Buffer.from("this is not an image at all");
    const out = await optimizeProductPhoto(junk, "image/jpeg");
    expect(out).toEqual({ data: junk, mime: "image/jpeg", optimized: false });
  });

  it("keeps the original when re-encoding would not make it smaller", async () => {
    const tiny = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    );
    const out = await optimizeProductPhoto(tiny, "image/png");
    expect(out.data.length).toBeLessThanOrEqual(tiny.length);
  });
});
