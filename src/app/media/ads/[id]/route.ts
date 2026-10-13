import { getMediaData } from "@/lib/ads/store";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return new Response("Not found", { status: 404 });
  const media = await getMediaData(id);
  if (!media) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(media.data), {
    headers: {
      "Content-Type": media.mime,
      // Served byte-for-byte, so animated GIFs keep animating. Ids are never reused.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
