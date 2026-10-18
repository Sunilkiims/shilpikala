import { describe, expect, it } from "vitest";
import {
  etagFor,
  immutableFileResponse,
  notModifiedResponse,
} from "@/lib/http/immutableMedia";

const req = (inm?: string) =>
  new Request("http://localhost/media/x", {
    headers: inm ? { "If-None-Match": inm } : {},
  });

describe("immutable media responses", () => {
  it("sends the bytes with a one-year immutable cache for browser and CDN, plus an ETag", async () => {
    const res = immutableFileResponse(
      new Uint8Array([1, 2, 3]),
      "image/webp",
      etagFor("img", 7),
    );
    expect(res.headers.get("Content-Type")).toBe("image/webp");
    expect(res.headers.get("Cache-Control")).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(res.headers.get("Vercel-CDN-Cache-Control")).toBe(
      "max-age=31536000",
    );
    expect(res.headers.get("ETag")).toBe('"img-7"');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    );
  });
  it("answers 304 for a matching ETag (also weak, also in a list) without a body", () => {
    for (const header of ['"img-7"', 'W/"img-7"', '"other", "img-7"']) {
      const res = notModifiedResponse(req(header), '"img-7"');
      expect(res?.status).toBe(304);
      expect(res?.headers.get("ETag")).toBe('"img-7"');
    }
  });
  it("does not answer 304 without a header or for a different file", () => {
    expect(notModifiedResponse(req(), '"img-7"')).toBeUndefined();
    expect(notModifiedResponse(req('"img-8"'), '"img-7"')).toBeUndefined();
  });
});
