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

  return NextResponse.json({ product: result.product });
}
