import { getMediaData } from "@/lib/ads/store";
import {
  etagFor,
  immutableFileResponse,
  notModifiedResponse,
} from "@/lib/http/immutableMedia";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1)
    return new Response("Not found", { status: 404 });
  const etag = etagFor("ad", id);
  const notModified = notModifiedResponse(request, etag);
  if (notModified) return notModified;

  const media = await getMediaData(id);
  if (!media) return new Response("Not found", { status: 404 });
  // Served byte-for-byte, so animated GIFs keep animating. Ids are never reused.
  return immutableFileResponse(new Uint8Array(media.data), media.mime, etag);
}
