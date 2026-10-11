import { IMAGE_MAX_BYTES, MAX_IMAGES, videoMaxBytes } from "@/lib/returns/config";
import { ReturnError } from "@/lib/returns/types";

export type EvidenceUpload = { kind: "image" | "video"; filename: string; mime: string; data: Buffer };

/**
 * The file's real type, from its first bytes — the browser-supplied
 * Content-Type and file name are never trusted.
 */
export function sniffMime(b: Buffer): { kind: "image" | "video"; mime: string } | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { kind: "image", mime: "image/jpeg" };
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return { kind: "image", mime: "image/png" };
  if (b.length >= 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP")
    return { kind: "image", mime: "image/webp" };
  if (b.length >= 12 && b.toString("ascii", 4, 8) === "ftyp") {
    return { kind: "video", mime: b.toString("ascii", 8, 12) === "qt  " ? "video/quicktime" : "video/mp4" };
  }
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { kind: "video", mime: "video/webm" };
  return null;
}

const safeName = (name: string) =>
  name.replace(/[\\/]/g, "_").replace(/[^\w.\- ]+/g, "").trim().slice(0, 80) || "evidence";

/** Validates the uploaded files: count, size and real type. Throws ReturnError. */
export function validateEvidence(files: { name: string; data: Buffer }[]): EvidenceUpload[] {
  const out: EvidenceUpload[] = [];
  let images = 0;
  let videos = 0;
  for (const file of files) {
    if (file.data.length === 0) throw new ReturnError("empty_file", 400);
    const type = sniffMime(file.data);
    if (!type) throw new ReturnError("unsupported_file_type", 400);
    if (type.kind === "image") {
      images++;
      if (file.data.length > IMAGE_MAX_BYTES) throw new ReturnError("file_too_large", 413);
    } else {
      videos++;
      if (file.data.length > videoMaxBytes()) throw new ReturnError("video_too_large", 413);
    }
    out.push({ kind: type.kind, mime: type.mime, filename: safeName(file.name), data: file.data });
  }
  if (images > MAX_IMAGES) throw new ReturnError("too_many_images", 400);
  if (videos > 1) throw new ReturnError("too_many_videos", 400);
  return out;
}
