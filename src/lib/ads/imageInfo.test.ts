import { describe, it, expect } from "vitest";
import { inspectImage } from "@/lib/ads/imageInfo";

// Tiny real files, built by hand.
const gif = (frames: number, w = 3, h = 2) => {
  const parts: number[] = [..."GIF89a"].map((c) => c.charCodeAt(0)).concat([w & 255, w >> 8, h & 255, h >> 8, 0x80, 0, 0, 0, 0, 0, 255, 255, 255]);
  for (let i = 0; i < frames; i++) {
    parts.push(0x21, 0xf9, 4, 0, 10, 0, 0, 0); // graphic control ext
    parts.push(0x2c, 0, 0, 0, 0, w & 255, w >> 8, h & 255, h >> 8, 0, 2, 2, 0x44, 0x01, 0);
  }
  parts.push(0x3b);
  return Buffer.from(parts);
};
const png = (w: number, h: number, animated = false) => {
  const b = Buffer.alloc(40);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8); b.write("IHDR", 12, "latin1"); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20);
  if (animated) b.write("acTL", 30, "latin1");
  return b;
};
const jpeg = (w: number, h: number) =>
  Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, h >> 8, h & 255, w >> 8, w & 255, 1, 1, 0x11, 0, 0xff, 0xd9]);

describe("inspectImage", () => {
  it("reads size and type from the bytes", () => {
    expect(inspectImage(png(1920, 600))).toMatchObject({ mime: "image/png", width: 1920, height: 600, animated: false });
    expect(inspectImage(jpeg(800, 400))).toMatchObject({ mime: "image/jpeg", width: 800, height: 400 });
    expect(inspectImage(gif(1, 300, 100))).toMatchObject({ mime: "image/gif", width: 300, height: 100 });
  });
  it("detects animation (multi-frame GIF, APNG) and not a single-frame GIF", () => {
    expect(inspectImage(gif(3))?.animated).toBe(true);
    expect(inspectImage(gif(1))?.animated).toBe(false);
    expect(inspectImage(png(10, 10, true))?.animated).toBe(true);
  });
  it("reads WebP (lossy, lossless, animated)", () => {
    const riff = (kind: string, body: Buffer) => Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP"), Buffer.from(kind), Buffer.alloc(4), body]);
    const vp8x = Buffer.alloc(14); vp8x[0] = 0x02; vp8x.writeUIntLE(1599, 4, 3); vp8x.writeUIntLE(499, 7, 3);
    expect(inspectImage(riff("VP8X", vp8x))).toMatchObject({ mime: "image/webp", width: 1600, height: 500, animated: true });
    const lossy = Buffer.alloc(14); lossy.writeUInt16LE(640, 6); lossy.writeUInt16LE(480, 8);
    expect(inspectImage(riff("VP8 ", lossy))).toMatchObject({ width: 640, height: 480, animated: false });
  });
  it("rejects everything else, whatever the filename or claimed type", () => {
    expect(inspectImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>'))).toBeUndefined();
    expect(inspectImage(Buffer.from("<html><script>alert(1)</script></html>"))).toBeUndefined();
    expect(inspectImage(Buffer.from("GIF89a"))).toBeUndefined();
    expect(inspectImage(Buffer.alloc(100))).toBeUndefined();
    expect(inspectImage(png(0, 0))).toBeUndefined();
    expect(inspectImage(png(9000, 100))).toBeUndefined();
  });
});
