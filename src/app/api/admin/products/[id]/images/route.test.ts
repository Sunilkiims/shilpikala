import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isolateStorageDir } from "@/test-support/tempStorageDir";
import { routeParams } from "@/test-support/request";

let cleanup: () => void;
let upload: (request: Request, ctx: ReturnType<typeof routeParams>) => Promise<Response>;
let removeImage: (
  request: Request,
  ctx: ReturnType<typeof routeParams<{ id: string; imageId: string }>>
) => Promise<Response>;
let catalog: typeof import("@/lib/store/catalogStore");
let productId: number;

// Smallest valid 1x1 PNG.
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

function uploadRequest(id: string | number, file?: File) {
  const form = new FormData();
  if (file) form.append("file", file);
  return new Request(`http://localhost/api/admin/products/${id}/images`, {
    method: "POST",
    body: form,
  });
}

function pngFile(name = "photo.png") {
  return new File([PNG_BYTES], name, { type: "image/png" });
}

async function storedImageCount(): Promise<number> {
  const { getDb } = await import("@/lib/db");
  const res = await (await getDb()).query("SELECT 1 FROM product_images");
  return res.rowCount;
}

beforeEach(async () => {
  cleanup = isolateStorageDir();
  catalog = await import("@/lib/store/catalogStore");
  ({ POST: upload } = await import("@/app/api/admin/products/[id]/images/route"));
  ({ DELETE: removeImage } = await import(
    "@/app/api/admin/products/[id]/images/[imageId]/route"
  ));

  const product = await catalog.createProduct({
    name: "Image Route Product",
    description: "For image route tests.",
    price: "100.00",
    regularPrice: "100.00",
    onSale: false,
    inStock: true,
    categorySlugs: [],
  });
  productId = product.id;
});

afterEach(() => cleanup());

describe("POST /api/admin/products/[id]/images", () => {
  it("stores the image in the database and records it on the product", async () => {
    const response = await upload(
      uploadRequest(productId, pngFile()),
      routeParams({ id: String(productId) })
    );

    expect(response.status).toBe(201);
    const { product } = await response.json();
    expect(product.images).toHaveLength(1);
    expect(product.images[0].src).toMatch(/^\/media\/product-images\/\d+$/);
    expect(await storedImageCount()).toBe(1);
  });

  it("never stores or exposes the client's filename (no path traversal)", async () => {
    const response = await upload(
      uploadRequest(productId, pngFile("../../../etc/passwd.png")),
      routeParams({ id: String(productId) })
    );

    const { product } = await response.json();
    expect(JSON.stringify(product)).not.toContain("passwd");
    expect(product.images[0].src).toMatch(/^\/media\/product-images\/\d+$/);
  });

  it("gives each uploaded image a distinct id", async () => {
    await upload(uploadRequest(productId, pngFile()), routeParams({ id: String(productId) }));
    const second = await upload(
      uploadRequest(productId, pngFile()),
      routeParams({ id: String(productId) })
    );

    const ids = (await second.json()).product.images.map((i: { id: number }) => i.id);
    expect(new Set(ids).size).toBe(2);
  });

  it("rejects an unsupported file type with 415 and writes nothing", async () => {
    const file = new File(["not an image"], "notes.txt", { type: "text/plain" });
    const response = await upload(uploadRequest(productId, file), routeParams({ id: String(productId) }));

    expect(response.status).toBe(415);
    expect(await response.json()).toEqual({ error: "unsupported_file_type" });
    expect(await storedImageCount()).toBe(0);
  });

  it("rejects a file over 5MB with 413 and writes nothing", async () => {
    const big = new File([Buffer.alloc(5 * 1024 * 1024 + 1, 1)], "big.png", { type: "image/png" });
    const response = await upload(uploadRequest(productId, big), routeParams({ id: String(productId) }));

    expect(response.status).toBe(413);
    expect(await storedImageCount()).toBe(0);
  });

  it("rejects an empty file", async () => {
    const empty = new File([], "empty.png", { type: "image/png" });
    const response = await upload(uploadRequest(productId, empty), routeParams({ id: String(productId) }));
    expect(response.status).toBe(400);
  });

  it("rejects a request with no file", async () => {
    const response = await upload(uploadRequest(productId), routeParams({ id: String(productId) }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "missing_file" });
  });

  it("returns 404 for an unknown product, writing nothing", async () => {
    const response = await upload(uploadRequest(999999, pngFile()), routeParams({ id: "999999" }));
    expect(response.status).toBe(404);
    expect(await storedImageCount()).toBe(0);
  });

  it("returns 400 for a non-numeric product id", async () => {
    const response = await upload(uploadRequest("abc", pngFile()), routeParams({ id: "abc" }));
    expect(response.status).toBe(400);
  });
});

describe("DELETE /api/admin/products/[id]/images/[imageId]", () => {
  async function uploadOne() {
    const response = await upload(
      uploadRequest(productId, pngFile()),
      routeParams({ id: String(productId) })
    );
    return (await response.json()).product.images[0] as { id: number; src: string };
  }

  it("removes the image and its stored bytes", async () => {
    const image = await uploadOne();
    expect(await storedImageCount()).toBe(1);

    const response = await removeImage(
      new Request("http://localhost/x", { method: "DELETE" }),
      routeParams({ id: String(productId), imageId: String(image.id) })
    );

    expect(response.status).toBe(200);
    expect((await response.json()).product.images).toHaveLength(0);
    expect(await storedImageCount()).toBe(0);
  });

  it("returns 404 for an unknown image id", async () => {
    const response = await removeImage(
      new Request("http://localhost/x", { method: "DELETE" }),
      routeParams({ id: String(productId), imageId: "999" })
    );
    expect(response.status).toBe(404);
  });

  it("won't remove an image belonging to a different product", async () => {
    const image = await uploadOne();
    const other = await catalog.createProduct({
      name: "Other",
      description: "x",
      price: "1.00",
      regularPrice: "1.00",
      onSale: false,
      inStock: true,
      categorySlugs: [],
    });

    const response = await removeImage(
      new Request("http://localhost/x", { method: "DELETE" }),
      routeParams({ id: String(other.id), imageId: String(image.id) })
    );

    expect(response.status).toBe(404);
    expect(await storedImageCount()).toBe(1);
  });
});
