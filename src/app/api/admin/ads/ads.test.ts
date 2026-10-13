import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isolateStorageDir } from "@/test-support/tempStorageDir";
import { jsonRequest, routeParams } from "@/test-support/request";

let cleanup: () => void;
type H = (r: Request, c?: never) => Promise<Response>;
type HP = (r: Request, c: ReturnType<typeof routeParams>) => Promise<Response>;
let create: { POST: H }, one: { PUT: HP; PATCH: HP; DELETE: HP }, upload: { POST: H }, preview: { POST: H };
let col: { POST: H }, colOne: { PUT: HP; DELETE: HP };
let media: { GET: HP };
let store: typeof import("@/lib/ads/store");
let pub: typeof import("@/lib/ads/public");
let catalog: typeof import("@/lib/catalog");

beforeEach(async () => {
  cleanup = isolateStorageDir();
  create = (await import("@/app/api/admin/ads/route")) as never;
  one = (await import("@/app/api/admin/ads/[id]/route")) as never;
  upload = (await import("@/app/api/admin/ads/media/route")) as never;
  preview = (await import("@/app/api/admin/ads/preview-products/route")) as never;
  col = (await import("@/app/api/admin/collections/route")) as never;
  colOne = (await import("@/app/api/admin/collections/[id]/route")) as never;
  media = (await import("@/app/media/ads/[id]/route")) as never;
  store = await import("@/lib/ads/store");
  pub = await import("@/lib/ads/public");
  catalog = await import("@/lib/catalog");
});
afterEach(() => cleanup());

const req = (method: string, body?: unknown) => jsonRequest("http://x", { method, body });
const gif = (frames: number) => {
  const p: number[] = [..."GIF89a"].map((c) => c.charCodeAt(0)).concat([4, 0, 2, 0, 0x80, 0, 0, 0, 0, 0, 255, 255, 255]);
  for (let i = 0; i < frames; i++) p.push(0x21, 0xf9, 4, 0, 10, 0, 0, 0, 0x2c, 0, 0, 0, 0, 4, 0, 2, 0, 0, 2, 2, 0x44, 0x01, 0);
  p.push(0x3b);
  return Buffer.from(p);
};
const form = (data: Buffer | string, name = "a.gif", type = "image/gif") => {
  const f = new FormData();
  f.set("file", new File([data as BlobPart], name, { type }));
  return new Request("http://x", { method: "POST", body: f });
};
async function up(data = gif(2)) { return (await (await upload.POST(form(data))).json()).media as { id: number; src: string; animated: boolean }; }
const hero = async (over: Record<string, unknown> = {}) => ({
  name: "Diwali", type: "hero", placement: "home_hero", heading: "Diwali Sale", destType: "none", published: true,
  desktopMediaId: (await up()).id, ...over,
});
async function ids() { const ps = await catalog.getAllProducts(); return ps.map((p) => p.id); }

describe("media upload", () => {
  it("stores an animated GIF byte-for-byte and serves it with its type", async () => {
    const data = gif(3);
    const m = await up(data);
    expect(m.animated).toBe(true);
    const res = await media.GET(req("GET"), routeParams({ id: String(m.id) }));
    expect(res.headers.get("content-type")).toBe("image/gif");
    expect(Buffer.from(await res.arrayBuffer()).equals(data)).toBe(true);
    expect(res.headers.get("cache-control")).toContain("immutable");
  });
  it("rejects SVG/HTML even when labelled as an image, empty files, and oversized files", async () => {
    expect((await upload.POST(form('<svg onload="x()"/>', "a.png", "image/png"))).status).toBe(415);
    expect((await upload.POST(form("<script>1</script>", "a.gif", "image/gif"))).status).toBe(415);
    expect((await upload.POST(form(Buffer.alloc(0)))).status).toBe(400);
    expect((await upload.POST(form(Buffer.concat([gif(1), Buffer.alloc(4 * 1024 * 1024 + 1)])))).status).toBe(413);
    expect((await upload.POST(new Request("http://x", { method: "POST", body: new FormData() }))).status).toBe(400);
  });
});

describe("ad CRUD and validation", () => {
  it("creates, edits, disables and deletes an ad", async () => {
    const created = await create.POST(req("POST", await hero()));
    expect(created.status).toBe(201);
    const { ad } = await created.json();
    expect((await one.PUT(req("PUT", { ...(await hero()), name: "Diwali v2", destType: "route", destRef: "/shop" }), routeParams({ id: String(ad.id) }))).status).toBe(200);
    const edited = await store.getAd(ad.id);
    expect(edited?.name).toBe("Diwali v2");
    expect(edited?.destRef).toBe("/shop");

    expect((await one.PATCH(req("PATCH", { enabled: false }), routeParams({ id: String(ad.id) }))).status).toBe(200);
    expect((await store.getAd(ad.id))?.enabled).toBe(false);

    expect((await one.DELETE(req("DELETE"), routeParams({ id: String(ad.id) }))).status).toBe(200);
    expect(await store.getAd(ad.id)).toBeUndefined();
    expect((await one.DELETE(req("DELETE"), routeParams({ id: String(ad.id) }))).status).toBe(404);
  });

  it("rejects bad input", async () => {
    const bad = async (over: Record<string, unknown>, error: string) => {
      const r = await create.POST(req("POST", await hero(over)));
      expect(r.status, error).toBe(400);
      expect((await r.json()).error).toBe(error);
    };
    await bad({ name: "" }, "name_required");
    await bad({ type: "popup" }, "invalid_type");
    await bad({ placement: "home_carousel" }, "invalid_placement");
    await bad({ destType: "external", destRef: "javascript:alert(1)" }, "invalid_url");
    await bad({ destType: "route", destRef: "//evil.com" }, "invalid_route");
    await bad({ destType: "route", destRef: "/admin" }, "invalid_route");
    await bad({ destType: "product", destRef: "99999" }, "product_not_found");
    await bad({ destType: "category", destRef: "99999" }, "category_not_found");
    await bad({ destType: "collection", destRef: "99999" }, "collection_not_found");
    await bad({ destType: "products", destProductIds: [] }, "products_required");
    await bad({ startsAt: "2030-02-01T00:00:00Z", endsAt: "2030-01-01T00:00:00Z" }, "end_before_start");
    await bad({ startsAt: "not-a-date" }, "invalid_start_date");
    await bad({ priority: 5000 }, "invalid_priority");
    await bad({ desktopMediaId: 424242 }, "media_not_found");
    await bad({ heading: "x".repeat(121) }, "heading_too_long");
    expect((await create.POST(req("POST", { ...(await hero()), desktopMediaId: undefined, published: true }))).status).toBe(400);
    // …but a draft without artwork is fine.
    expect((await create.POST(req("POST", { ...(await hero()), desktopMediaId: undefined, published: false }))).status).toBe(201);
    expect((await create.POST(new Request("http://x", { method: "POST", body: "{nope" }))).status).toBe(400);
  });

  it("removes artwork nobody uses any more when an ad is edited or deleted", async () => {
    const a = await up(), b = await up();
    const { ad } = await (await create.POST(req("POST", await hero({ desktopMediaId: a.id })))).json();
    await one.PUT(req("PUT", await hero({ desktopMediaId: b.id })), routeParams({ id: String(ad.id) }));
    expect(await store.getMediaData(a.id)).toBeUndefined();
    expect(await store.getMediaData(b.id)).toBeDefined();
    await one.DELETE(req("DELETE"), routeParams({ id: String(ad.id) }));
    expect(await store.getMediaData(b.id)).toBeUndefined();
  });
});

describe("scheduling and status", () => {
  const day = 86400000;
  const iso = (d: number) => new Date(Date.now() + d * day).toISOString();
  it("shows only active, enabled, published ads inside their dates", async () => {
    const mk = async (name: string, over: Record<string, unknown>) =>
      (await (await create.POST(req("POST", await hero({ name, ...over })))).json()).ad.id as number;
    const active = await mk("active", {});
    const windowed = await mk("windowed", { startsAt: iso(-1), endsAt: iso(1) });
    const future = await mk("future", { startsAt: iso(1) });
    const past = await mk("past", { endsAt: iso(-1) });
    const off = await mk("off", { enabled: false });
    const draft = await mk("draft", { published: false });

    const live = (await pub.getLiveRenderableAds("home_hero")).map((a) => a.id).sort();
    expect(live).toEqual([active, windowed].sort());

    const status = Object.fromEntries((await store.listAds()).map((a) => [a.id, a.status]));
    expect(status).toMatchObject({ [active]: "active", [windowed]: "active", [future]: "scheduled", [past]: "expired", [off]: "disabled", [draft]: "draft" });
    expect((await store.listAds({ status: "scheduled" })).map((a) => a.id)).toEqual([future]);
    expect((await store.listAds({ q: "WINDOW" })).map((a) => a.id)).toEqual([windowed]);
  });

  it("orders by priority, then position, and move up/down swaps neighbours", async () => {
    const mk = async (name: string, priority: number) => (await (await create.POST(req("POST", await hero({ name, priority })))).json()).ad.id as number;
    const a = await mk("a", 0), b = await mk("b", 5), c = await mk("c", 0);
    const order = async () => (await pub.getLiveRenderableAds("home_hero")).map((x) => x.id);
    expect(await order()).toEqual([b, a, c]);
    await one.PATCH(req("PATCH", { move: "down" }), routeParams({ id: String(b) }));
    expect(await order()).toEqual([a, b, c]);
    await one.PATCH(req("PATCH", { move: "up" }), routeParams({ id: String(c) }));
    expect(await order()).toEqual([a, c, b]);
    await one.PATCH(req("PATCH", { move: "up" }), routeParams({ id: String(a) })); // already first
    expect(await order()).toEqual([a, c, b]);
  });
});

describe("destinations resolve to real routes and fail safely", () => {
  it("links to the existing product, category, collection and listing routes", async () => {
    const [p] = await catalog.getAllProducts();
    const [cat] = await catalog.getAllCategories();
    const c = (await (await col.POST(req("POST", { name: "Diwali Gifts", productIds: [p.id] }))).json()).collection;
    const href = async (over: Record<string, unknown>) => {
      const r = await create.POST(req("POST", await hero({ ...over, name: JSON.stringify(over).slice(0, 50) })));
      expect(r.status).toBe(201);
      const newId = (await r.json()).ad.id;
      return (await pub.getLiveRenderableAds("home_hero")).find((a) => a.id === newId)?.href;
    };
    expect(await href({ destType: "product", destRef: String(p.id) })).toBe(`/product/${p.slug}`);
    expect(await href({ destType: "category", destRef: String(cat.id) })).toBe(`/categories/${cat.slug}`);
    expect(await href({ destType: "collection", destRef: String(c.id) })).toBe("/collections/diwali-gifts");
    expect(await href({ destType: "route", destRef: "/shop" })).toBe("/shop");
    expect(await href({ destType: "external", destRef: "https://example.com/x" })).toBe("https://example.com/x");
    expect(await href({ destType: "products", destProductIds: [p.id] })).toMatch(/^\/promotions\/\d+$/);
  });

  it("hides an ad whose product or collection was deleted, instead of showing a dead link", async () => {
    const c = (await (await col.POST(req("POST", { name: "Temp", productIds: [] }))).json()).collection;
    const { ad } = await (await create.POST(req("POST", await hero({ destType: "collection", destRef: String(c.id) })))).json();
    expect((await pub.getLiveRenderableAds("home_hero")).map((a) => a.id)).toContain(ad.id);
    await colOne.DELETE(req("DELETE"), routeParams({ id: String(c.id) }));
    expect((await pub.getLiveRenderableAds("home_hero")).map((a) => a.id)).not.toContain(ad.id);
    expect((await pub.destinationIsBroken([(await store.getAd(ad.id))!])).has(ad.id)).toBe(true);
  });
});

describe("product carousels", () => {
  const carousel = (over: Record<string, unknown>) => ({
    name: "Deals", type: "carousel", placement: "home_carousel", heading: "Deals", destType: "none", published: true, ...over,
  });
  it("manual selection keeps the admin's order and uses live catalogue data", async () => {
    const all = await ids();
    const pick = [all[2], all[0], all[1]];
    const r = await create.POST(req("POST", carousel({ sourceType: "manual", productIds: pick })));
    expect(r.status).toBe(201);
    const [ad] = await pub.getLiveRenderableAds("home_carousel");
    expect(ad.products!.map((p) => p.id)).toEqual(pick);
    const real = await catalog.getProductById(pick[0]);
    expect(ad.products![0].price).toBe(real!.price); // not copied into the ad
  });
  it("category source returns only that category's products", async () => {
    const cats = await catalog.getAllCategories();
    for (const cat of cats) {
      const ps = await pub.pickCarouselProducts({ sourceType: "category", sourceRef: cat.id, productIds: [], maxItems: 24 });
      expect(ps.every((p) => p.categories.some((x) => x.id === cat.id))).toBe(true);
      expect(ps.length).toBe((await catalog.getProductsByCategorySlug(cat.slug)).length > 24 ? 24 : (await catalog.getProductsByCategorySlug(cat.slug)).length);
    }
  });
  it("shows a discount only when the sale price is really lower", async () => {
    const [p] = await catalog.getAllProducts();
    const store2 = await import("@/lib/store/catalogStore");
    await store2.updateProduct(p.id, { ...p, onSale: true, salePrice: String(Number(p.regularPrice) / 2), price: String(Number(p.regularPrice) / 2), categorySlugs: p.categories.map((c) => c.slug) } as never);
    expect(pub.toCard((await catalog.getProductById(p.id))!).discountPercent).toBe(50);
    const noSale = { ...p, onSale: true, salePrice: p.regularPrice };
    expect(pub.toCard(noSale).discountPercent).toBeUndefined();
    expect(pub.toCard({ ...p, onSale: false, salePrice: undefined }).discountPercent).toBeUndefined();
  });
  it("on_sale / new_arrivals / bestsellers / collection sources", async () => {
    const all = await ids();
    const newest = await pub.pickCarouselProducts({ sourceType: "new_arrivals", productIds: [], maxItems: 3 });
    expect(newest.map((p) => p.id)).toEqual([...all].sort((a, b) => b - a).slice(0, 3));
    // No orders yet: nothing to call a bestseller.
    expect(await pub.pickCarouselProducts({ sourceType: "bestsellers", productIds: [], maxItems: 5 })).toEqual([]);
    const c = (await (await col.POST(req("POST", { name: "Mine", productIds: [all[1], all[0]] }))).json()).collection;
    expect((await pub.pickCarouselProducts({ sourceType: "collection", sourceRef: c.id, productIds: [], maxItems: 5 })).map((p) => p.id)).toEqual([all[1], all[0]]);
    const r = await preview.POST(req("POST", { sourceType: "collection", sourceRef: c.id, maxItems: 5 }));
    expect((await r.json()).products.map((p: { id: number }) => p.id)).toEqual([all[1], all[0]]);
  });
  it("bestsellers ranks by units in real, non-cancelled orders", async () => {
    const all = await ids();
    const { getDb } = await import("@/lib/db");
    const db = await getDb();
    const ins = (id: string, status: string, items: unknown[]) =>
      db.query(`INSERT INTO orders (id, razorpay_order_id, razorpay_payment_id, items_subtotal, shipping, amount, customer_email, address, items, status)
                VALUES ($1,$2,$3,1,0,1,'a@b.c','{}'::jsonb,$4::jsonb,$5)`, [id, "o" + id, "p" + id, JSON.stringify(items), status]);
    await ins("1", "paid", [{ productId: all[1], quantity: 1 }, { productId: all[0], quantity: 5 }]);
    await ins("2", "delivered", [{ productId: all[1], quantity: 2 }]);
    await ins("3", "cancelled", [{ productId: all[2], quantity: 99 }]);
    const best = await pub.pickCarouselProducts({ sourceType: "bestsellers", productIds: [], maxItems: 5 });
    expect(best.map((p) => p.id)).toEqual([all[0], all[1]]);
  });
  it("is hidden when it has no products, and a deleted product is skipped", async () => {
    const all = await ids();
    const { ad } = await (await create.POST(req("POST", carousel({ sourceType: "manual", productIds: [all[0]] })))).json();
    expect((await pub.getLiveRenderableAds("home_carousel")).length).toBe(1);
    const cat = await import("@/lib/store/catalogStore");
    await cat.deleteProduct(all[0]);
    expect((await pub.getLiveRenderableAds("home_carousel")).length).toBe(0);
    expect(ad.id).toBeGreaterThan(0);
  });
});

describe("category page placement", () => {
  it("shows scoped ads only on their category and unscoped ones everywhere", async () => {
    const [c1, c2] = await catalog.getAllCategories();
    const mk = async (name: string, categoryId?: number) =>
      (await (await create.POST(req("POST", await hero({ name, type: "category_banner", placement: "category_page", categoryId })))).json()).ad.id as number;
    const scoped = await mk("scoped", c1.id), everywhere = await mk("all");
    expect((await pub.getLiveRenderableAds("category_page", c1.id)).map((a) => a.id).sort()).toEqual([scoped, everywhere].sort());
    expect((await pub.getLiveRenderableAds("category_page", c2.id)).map((a) => a.id)).toEqual([everywhere]);
  });
});

describe("collections", () => {
  it("creates unique slugs, validates products, and edits keep the slug stable", async () => {
    const all = await ids();
    const a = (await (await col.POST(req("POST", { name: "Festive", productIds: [all[0]] }))).json()).collection;
    const b = (await (await col.POST(req("POST", { name: "Festive", productIds: [] }))).json()).collection;
    expect([a.slug, b.slug]).toEqual(["festive", "festive-2"]);
    expect((await col.POST(req("POST", { name: "Bad", productIds: [999999] }))).status).toBe(400);
    expect((await col.POST(req("POST", { name: "", productIds: [] }))).status).toBe(400);
    const upd = await colOne.PUT(req("PUT", { name: "Festive", productIds: [all[1], all[0]] }), routeParams({ id: String(a.id) }));
    expect((await upd.json()).collection).toMatchObject({ slug: "festive", productIds: [all[1], all[0]] });
  });
});

describe("settings", () => {
  it("validates and persists hero autoplay", async () => {
    const { PUT } = (await import("@/app/api/admin/ads/settings/route")) as { PUT: H };
    expect((await PUT(req("PUT", { heroAutoplay: false, heroIntervalSeconds: 8 }))).status).toBe(200);
    expect(await store.getSettings()).toEqual({ heroAutoplay: false, heroIntervalSeconds: 8 });
    expect((await PUT(req("PUT", { heroAutoplay: true, heroIntervalSeconds: 1 }))).status).toBe(400);
  });
});
