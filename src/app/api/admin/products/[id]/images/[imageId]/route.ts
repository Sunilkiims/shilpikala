import { unlink } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { removeProductImage } from "@/lib/store/catalogStore";

type RouteParams = {
  params: Promise<{ id: string; imageId: string }>;
};

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id, imageId } = await params;
  const productId = Number(id);
  const imageIdNum = Number(imageId);
  if (!Number.isFinite(productId) || !Number.isFinite(imageIdNum)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const result = await removeProductImage(productId, imageIdNum);
  if (!result) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Best-effort file cleanup — only ever removes a file under
  // public/images/products, and a missing/locked file shouldn't block
  // the catalogue update that already succeeded above.
  const filename = path.basename(result.removedImage.src);
  const filePath = path.join(
    process.cwd(),
    "public",
    "images",
    "products",
    filename
  );
  try {
    await unlink(filePath);
  } catch (error) {
    console.error(`[admin] Could not remove image file ${filePath}:`, error);
  }

  return NextResponse.json({ product: result.product });
}
