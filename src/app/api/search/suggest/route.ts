import { NextResponse } from "next/server";
import { getNavModel } from "@/lib/shop/storefront";
import { queryProducts } from "@/lib/store/catalogQuery";
import { limitAttempts } from "@/lib/auth/guard";

/** Type-ahead for the header search: real products and categories, nothing else. */
export async function GET(request: Request) {
  const limited = limitAttempts(request, "suggest", 120, 60 * 1000);
  if (limited) return limited;

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ products: [], categories: [] });

  const [{ products }, nav] = await Promise.all([queryProducts({ q, pageSize: 6 }), getNavModel()]);
  const needle = q.toLowerCase();
  const categories = nav.categories
    .filter((c) => c.name.toLowerCase().includes(needle))
    .slice(0, 3)
    .map((c) => ({ name: c.name, slug: c.slug }));

  return NextResponse.json(
    {
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: p.onSale && p.salePrice ? p.salePrice : p.price,
        image: p.images[0]?.src ?? null,
        inStock: p.inStock,
      })),
      categories,
    },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } }
  );
}
