import { NextResponse } from "next/server";
import { getCartPrices } from "@/lib/offers/cartPrices";

/**
 * The cart's source of truth for prices. The browser keeps a copy of each item's price in
 * localStorage, which can be stale (an offer started, ended, or a price was edited), so the cart
 * asks here and displays what comes back. Checkout re-prices again on its own regardless.
 */
export async function POST(request: Request) {
  let body: { productIds?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const ids = body?.productIds;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100 || !ids.every((x) => Number.isInteger(x) && x > 0)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  return NextResponse.json(
    { prices: await getCartPrices(ids as number[]) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
