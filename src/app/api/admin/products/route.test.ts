import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isolateStorageDir } from "@/test-support/tempStorageDir";
import { jsonRequest, malformedJsonRequest, routeParams } from "@/test-support/request";

const COLLECTION = "http://localhost/api/admin/products";

let cleanup: () => void;
let create: (request: Request) => Promise<Response>;
let handlers: {
  PATCH: (request: Request, ctx: ReturnType<typeof routeParams>) => Promise<Response>;
  DELETE: (request: Request, ctx: ReturnType<typeof routeParams>) => Promise<Response>;
};
let catalog: typeof import("@/lib/store/catalogStore");

const validBody = {
  name: "Admin Test Piece",
  description: "Created through the admin API.",
  price: "2500.00",
  onSale: false,
  inStock: true,
  categorySlugs: [],
};

beforeEach(async () => {
  cleanup = isolateStorageDir();
  catalog = await import("@/lib/store/catalogStore");
  ({ POST: create } = await import("@/app/api/admin/products/route"));
  handlers = await import("@/app/api/admin/products/[id]/route");
});

afterEach(() => cleanup());

describe("POST /api/admin/products", () => {
  it("creates a product and returns 201 with the generated id and slug", async () => {
    const response = await create(jsonRequest(COLLECTION, { body: validBody }));
    expect(response.status).toBe(201);

    const { product } = await response.json();
    expect(product.name).toBe("Admin Test Piece");
    expect(product.slug).toBe("admin-test-piece");
    expect(product.id).toBeGreaterThan(0);

    const stored = await catalog.getProducts();
    expect(stored.some((p) => p.id === product.id)).toBe(true);
  });

  it("rejects an invalid body with a specific 400 and creates nothing", async () => {
    const before = (await catalog.getProducts()).length;

    const response = await create(jsonRequest(COLLECTION, { body: { ...validBody, price: "free" } }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_price" });
    expect((await catalog.getProducts()).length).toBe(before);
  });

  it("rejects malformed JSON", async () => {
    expect((await create(malformedJsonRequest(COLLECTION))).status).toBe(400);
  });

  it("derives inStock from a tracked stock quantity", async () => {
    const response = await create(
      jsonRequest(COLLECTION, { body: { ...validBody, inStock: true, stockQuantity: 0 } })
    );
    const { product } = await response.json();
    expect(product.stockQuantity).toBe(0);
    expect(product.inStock).toBe(false);
  });
});

describe("PATCH /api/admin/products/[id]", () => {
  it("updates an existing product", async () => {
    const created = await catalog.createProduct({
      ...validBody,
      regularPrice: "2500.00",
    });
    const url = `${COLLECTION}/${created.id}`;

    const response = await handlers.PATCH(
      jsonRequest(url, { method: "PATCH", body: { ...validBody, price: "3000.00" } }),
      routeParams({ id: String(created.id) })
    );

    expect(response.status).toBe(200);
    expect((await response.json()).product.price).toBe("3000.00");
  });

  it("returns 404 for an unknown product", async () => {
    const response = await handlers.PATCH(
      jsonRequest(`${COLLECTION}/999999`, { method: "PATCH", body: validBody }),
      routeParams({ id: "999999" })
    );
    expect(response.status).toBe(404);
  });

  it("returns 400 for a non-numeric id", async () => {
    const response = await handlers.PATCH(
      jsonRequest(`${COLLECTION}/abc`, { method: "PATCH", body: validBody }),
      routeParams({ id: "abc" })
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_id" });
  });

  it("returns 400 for an invalid body", async () => {
    const created = await catalog.createProduct({ ...validBody, regularPrice: "2500.00" });
    const response = await handlers.PATCH(
      jsonRequest(`${COLLECTION}/${created.id}`, {
        method: "PATCH",
        body: { ...validBody, name: "" },
      }),
      routeParams({ id: String(created.id) })
    );
    expect(response.status).toBe(400);
  });
});

describe("DELETE /api/admin/products/[id]", () => {
  it("deletes a product", async () => {
    const created = await catalog.createProduct({ ...validBody, regularPrice: "2500.00" });

    const response = await handlers.DELETE(
      jsonRequest(`${COLLECTION}/${created.id}`, { method: "DELETE" }),
      routeParams({ id: String(created.id) })
    );

    expect(response.status).toBe(200);
    expect((await catalog.getProducts()).some((p) => p.id === created.id)).toBe(false);
  });

  it("returns 404 when deleting a product that doesn't exist", async () => {
    const response = await handlers.DELETE(
      jsonRequest(`${COLLECTION}/999999`, { method: "DELETE" }),
      routeParams({ id: "999999" })
    );
    expect(response.status).toBe(404);
  });
});
