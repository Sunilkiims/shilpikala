import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { addProductImage, getProducts } from "@/lib/store/catalogStore";

type RouteParams = {
  params: Promise<{ id: string }>;
};

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const PRODUCTS_IMAGE_DIR = path.join(
  process.cwd(),
  "public",
  "images",
  "products"
);

function nextImageId(images: { id: number }[]): number {
  return images.reduce((max, image) => Math.max(max, image.id), 0) + 1;
}

export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isFinite(productId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const products = await getProducts();
  const product = products.find((p) => p.id === productId);
  if (!product) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form_data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }

  const extension = ALLOWED_TYPES[file.type];
  if (!extension) {
    return NextResponse.json(
      { error: "unsupported_file_type" },
      { status: 415 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0) {
    return NextResponse.json({ error: "empty_file" }, { status: 400 });
  }
  if (buffer.length > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 413 });
  }

  // Never trust the original filename — generate our own, so there's no
  // path-traversal or collision risk from what the browser sent.
  const filename = `${productId}-${randomUUID()}.${extension}`;

  try {
    await mkdir(PRODUCTS_IMAGE_DIR, { recursive: true });
    await writeFile(path.join(PRODUCTS_IMAGE_DIR, filename), buffer);
  } catch (error) {
    console.error("[admin] Failed to write product image:", error);
    return NextResponse.json({ error: "write_failed" }, { status: 500 });
  }

  const image = {
    id: nextImageId(product.images),
    src: `/images/products/${filename}`,
    alt: product.name,
  };

  const updated = await addProductImage(productId, image);
  if (!updated) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ product: updated }, { status: 201 });
}
