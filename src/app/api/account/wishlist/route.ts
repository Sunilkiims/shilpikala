import { NextResponse } from "next/server";
import { addWishlistItem, listWishlistIds, mergeWishlist } from "@/lib/account/wishlistStore";
import { readJson } from "@/lib/auth/guard";
import { getCustomerFromRequest } from "@/lib/auth/session";

/** Every handler reads the customer from the session, never from the request body. */
export async function GET(request: Request) {
  const customer = await getCustomerFromRequest(request);
  if (!customer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ productIds: await listWishlistIds(customer.id) });
}

/** `{ productId }` adds one product; `{ productIds: [...] }` merges a signed-out wishlist. */
export async function POST(request: Request) {
  const customer = await getCustomerFromRequest(request);
  if (!customer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(request);
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  if (Array.isArray(body.productIds)) {
    return NextResponse.json({ productIds: await mergeWishlist(customer.id, body.productIds) });
  }
  const id = body.productId;
  if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "invalid_product" }, { status: 400 });
  }
  await addWishlistItem(customer.id, id);
  return NextResponse.json({ productIds: await listWishlistIds(customer.id) });
}
