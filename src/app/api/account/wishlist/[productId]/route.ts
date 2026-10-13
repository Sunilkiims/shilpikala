import { NextResponse } from "next/server";
import { listWishlistIds, removeWishlistItem } from "@/lib/account/wishlistStore";
import { getCustomerFromRequest } from "@/lib/auth/session";

export async function DELETE(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  const customer = await getCustomerFromRequest(request);
  if (!customer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = Number((await params).productId);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "invalid_product" }, { status: 400 });
  await removeWishlistItem(customer.id, id);
  return NextResponse.json({ productIds: await listWishlistIds(customer.id) });
}
