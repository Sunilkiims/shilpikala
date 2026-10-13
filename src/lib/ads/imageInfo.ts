import { LIMITS } from "@/lib/ads/types";

export type ImageInfo = { mime: "image/jpeg" | "image/png" | "image/gif" | "image/webp"; width: number; height: number; animated: boolean };

/**
 * Identifies an upload from its own bytes (the browser-declared type is never trusted),
 * reads its pixel size (so pages can reserve space and avoid layout shift) and detects
 * animation. Returns undefined for anything that is not a well-formed JPEG/PNG/GIF/WebP.
 * Animated files are stored exactly as uploaded - nothing here re-encodes.
 */
export function inspectImage(b: Buffer): ImageInfo | undefined {
  const info = sniff(b);
  if (!info) return undefined;
  if (info.width < 1 || info.height < 1 || info.width > LIMITS.maxDimension || info.height > LIMITS.maxDimension) return undefined;
  return info;
}

function sniff(b: Buffer): ImageInfo | undefined {
  if (b.length < 12) return undefined;
  // GIF
  if (b.toString("latin1", 0, 6) === "GIF87a" || b.toString("latin1", 0, 6) === "GIF89a") {
    return { mime: "image/gif", width: b.readUInt16LE(6), height: b.readUInt16LE(8), animated: gifFrames(b) > 1 };
  }
  // PNG
  if (b.length >= 24 && b.readUInt32BE(0) === 0x89504e47 && b.readUInt32BE(4) === 0x0d0a1a0a && b.toString("latin1", 12, 16) === "IHDR") {
    return { mime: "image/png", width: b.readUInt32BE(16), height: b.readUInt32BE(20), animated: b.includes(Buffer.from("acTL")) };
  }
  // JPEG
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    const size = jpegSize(b);
    return size ? { mime: "image/jpeg", ...size, animated: false } : undefined;
  }
  // WebP
  if (b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP") {
    return webpInfo(b);
  }
  return undefined;
}

/** Counts image frames by walking the GIF block structure (so bytes inside pixel data never confuse it). */
function gifFrames(b: Buffer): number {
  let pos = 13;
  const flags = b[10];
  if (flags & 0x80) pos += 3 * 2 ** ((flags & 7) + 1);
  let frames = 0;
  const skipSubBlocks = () => {
    while (pos < b.length && b[pos] !== 0) pos += b[pos] + 1;
    pos += 1;
  };
  while (pos < b.length) {
    const marker = b[pos++];
    if (marker === 0x3b) break;
    if (marker === 0x21) {
      pos += 1;
      skipSubBlocks();
    } else if (marker === 0x2c) {
      frames += 1;
      if (frames > 1) return frames;
      const f = b[pos + 8];
      pos += 9;
      if (f & 0x80) pos += 3 * 2 ** ((f & 7) + 1);
      pos += 1; // LZW minimum code size
      skipSubBlocks();
    } else {
      break;
    }
  }
  return frames;
}

function jpegSize(b: Buffer): { width: number; height: number } | undefined {
  let pos = 2;
  while (pos + 9 < b.length) {
    if (b[pos] !== 0xff) { pos += 1; continue; }
    const marker = b[pos + 1];
    if (marker === 0xff) { pos += 1; continue; }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { pos += 2; continue; }
    const len = b.readUInt16BE(pos + 2);
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) return { height: b.readUInt16BE(pos + 5), width: b.readUInt16BE(pos + 7) };
    pos += 2 + len;
  }
  return undefined;
}

function webpInfo(b: Buffer): ImageInfo | undefined {
  const kind = b.toString("latin1", 12, 16);
  if (kind === "VP8X" && b.length >= 30) {
    return {
      mime: "image/webp",
      width: 1 + b.readUIntLE(24, 3),
      height: 1 + b.readUIntLE(27, 3),
      animated: (b[20] & 0x02) !== 0,
    };
  }
  if (kind === "VP8 " && b.length >= 30) {
    return { mime: "image/webp", width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff, animated: false };
  }
  if (kind === "VP8L" && b.length >= 25 && b[20] === 0x2f) {
    const bits = b.readUInt32LE(21);
    return { mime: "image/webp", width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1, animated: false };
  }
  return undefined;
}
