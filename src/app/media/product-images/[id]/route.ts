import { getProductImageData } from "@/lib/store/catalogStore";
import {
  etagFor,
  immutableFileResponse,
  notModifiedResponse,
} from "@/lib/http/immutableMedia";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const imageId = Number(id);
  if (!Number.isInteger(imageId) || imageId < 1) {
    return new Response("Not found", { status: 404 });
  }
  // Image ids are never reused, so the bytes behind a URL never change: a browser that already
  // has this file gets a 304 without reading the (large) image out of the database again.
  const etag = etagFor("img", imageId);
  const notModified = notModifiedResponse(request, etag);
  if (notModified) return notModified;

  const image = await getProductImageData(imageId);
  if (!image) return new Response("Not found", { status: 404 });
  return immutableFileResponse(new Uint8Array(image.data), image.mime, etag);
}
