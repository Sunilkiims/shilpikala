import { NextResponse } from "next/server";
import { inspectImage } from "@/lib/ads/imageInfo";
import { createMedia, deleteOrphanMedia } from "@/lib/ads/store";
import { LIMITS } from "@/lib/ads/types";

/**
 * Upload artwork for an ad. The file type is decided from the file's own bytes
 * (JPEG, PNG, GIF, WebP only; SVG and anything else is refused), size is capped, and
 * the bytes are stored untouched, so animated GIFs stay animated.
 */
export async function POST(request: Request) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > LIMITS.maxMediaBytes + 64 * 1024) return NextResponse.json({ error: "file_too_large" }, { status: 413 });

  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: "invalid_form_data" }, { status: 400 }); }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "missing_file" }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: "empty_file" }, { status: 400 });
  if (file.size > LIMITS.maxMediaBytes) return NextResponse.json({ error: "file_too_large" }, { status: 413 });

  const data = Buffer.from(await file.arrayBuffer());
  const info = inspectImage(data);
  if (!info) return NextResponse.json({ error: "unsupported_file_type" }, { status: 415 });

  void deleteOrphanMedia().catch(() => undefined); // housekeeping for abandoned uploads
  return NextResponse.json({ media: await createMedia(info, data) }, { status: 201 });
}
