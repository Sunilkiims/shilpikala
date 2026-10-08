import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isolateStorageDir } from "@/test-support/tempStorageDir";
import { jsonRequest, malformedJsonRequest, routeParams } from "@/test-support/request";

const COLLECTION = "http://localhost/api/admin/categories";

let cleanup: () => void;
let create: (request: Request) => Promise<Response>;
let remove: (request: Request, ctx: ReturnType<typeof routeParams>) => Promise<Response>;
let catalog: typeof import("@/lib/store/catalogStore");

beforeEach(async () => {
  cleanup = isolateStorageDir();
  catalog = await import("@/lib/store/catalogStore");
  ({ POST: create } = await import("@/app/api/admin/categories/route"));
  ({ DELETE: remove } = await import("@/app/api/admin/categories/[id]/route"));
});

afterEach(() => cleanup());

describe("POST /api/admin/categories", () => {
  it("creates a category with a generated slug", async () => {
    const response = await create(
      jsonRequest(COLLECTION, { body: { name: "Festival Specials", description: "Seasonal." } })
    );

    expect(response.status).toBe(201);
    const { category } = await response.json();
    expect(category.slug).toBe("festival-specials");
    expect((await catalog.getCategories()).some((c) => c.id === category.id)).toBe(true);
  });

  it("de-duplicates a colliding slug", async () => {
    await create(jsonRequest(COLLECTION, { body: { name: "Twin" } }));
    const second = await create(jsonRequest(COLLECTION, { body: { name: "Twin" } }));

    expect((await second.json()).category.slug).toBe("twin-2");
  });

  it("rejects a missing name with 400", async () => {
    const response = await create(jsonRequest(COLLECTION, { body: { name: "  " } }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "name_required" });
  });

  it("rejects malformed JSON", async () => {
    expect((await create(malformedJsonRequest(COLLECTION))).status).toBe(400);
  });
});

describe("DELETE /api/admin/categories/[id]", () => {
  it("deletes a category and unassigns it from its products", async () => {
    const category = await catalog.createCategory({ name: "Temporary" });
    const product = await catalog.createProduct({
      name: "Has Temporary Category",
      description: "Test.",
      price: "100.00",
      regularPrice: "100.00",
      onSale: false,
      inStock: true,
      categorySlugs: [category.slug],
    });

    const response = await remove(
      jsonRequest(`${COLLECTION}/${category.id}`, { method: "DELETE" }),
      routeParams({ id: String(category.id) })
    );

    expect(response.status).toBe(200);
    const survivor = (await catalog.getProducts()).find((p) => p.id === product.id);
    expect(survivor).toBeDefined();
    expect(survivor?.categories).toHaveLength(0);
  });

  it("returns 404 for an unknown category", async () => {
    const response = await remove(
      jsonRequest(`${COLLECTION}/999999`, { method: "DELETE" }),
      routeParams({ id: "999999" })
    );
    expect(response.status).toBe(404);
  });

  it("returns 400 for a non-numeric id", async () => {
    const response = await remove(
      jsonRequest(`${COLLECTION}/abc`, { method: "DELETE" }),
      routeParams({ id: "abc" })
    );
    expect(response.status).toBe(400);
  });
});
