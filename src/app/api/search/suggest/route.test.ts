import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isolateStorageDir } from "@/test-support/tempStorageDir";

let cleanup: () => void;
let GET: (request: Request) => Promise<Response>;
let catalog: typeof import("@/lib/store/catalogStore");

const url = (q: string) => new Request(`http://localhost/api/search/suggest?q=${encodeURIComponent(q)}`);

beforeEach(async () => {
  cleanup = isolateStorageDir();
  catalog = await import("@/lib/store/catalogStore");
  ({ GET } = await import("@/app/api/search/suggest/route"));
});
afterEach(() => cleanup());

describe("GET /api/search/suggest", () => {
  it("returns nothing for queries shorter than two characters", async () => {
    const body = await (await GET(url("m"))).json();
    expect(body).toEqual({ products: [], categories: [] });
  });

  it("suggests real catalogue products by name", async () => {
    const created = await catalog.createProduct({
      name: "Zorbaflux Mandala Plate",
      description: "d",
      price: "1200.00",
      regularPrice: "1200.00",
      onSale: false,
      inStock: true,
      categorySlugs: [],
    } as never);
    const body = await (await GET(url("zorbaflux"))).json();
    expect(body.products.map((p: { id: number }) => p.id)).toEqual([created.id]);
    expect(Object.keys(body.products[0]).sort()).toEqual(["id", "image", "inStock", "name", "price", "slug"]);
  });

  it("returns no products for an unmatched term", async () => {
    const body = await (await GET(url("qqqxxzz"))).json();
    expect(body.products).toEqual([]);
  });
});
