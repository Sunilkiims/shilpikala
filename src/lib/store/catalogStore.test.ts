import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { useTempStorageDir } from "@/test-support/tempStorageDir";
import type * as CatalogStoreModule from "@/lib/store/catalogStore";

let cleanup: () => void;
let store: typeof CatalogStoreModule;

beforeEach(async () => {
  cleanup = useTempStorageDir();
  store = await import("@/lib/store/catalogStore");
});

afterEach(() => {
  cleanup();
});

describe("catalogStore seeding", () => {
  it("seeds from the static seed data on first read", async () => {
    const products = await store.getProducts();
    const categories = await store.getCategories();

    expect(products.length).toBeGreaterThan(0);
    expect(categories.length).toBeGreaterThan(0);
  });

  it("persists the seed so a second read returns the same data without reseeding", async () => {
    const first = await store.getProducts();
    const second = await store.getProducts();
    expect(second).toEqual(first);
  });
});

describe("catalogStore product CRUD", () => {
  it("creates a product with an auto-incrementing id and a derived slug", async () => {
    const before = await store.getProducts();
    const maxIdBefore = Math.max(...before.map((p) => p.id));

    const created = await store.createProduct({
      name: "Brand New Piece",
      description: "A freshly created test product.",
      price: "999.00",
      regularPrice: "999.00",
      onSale: false,
      inStock: true,
      categorySlugs: [],
    });

    expect(created.id).toBe(maxIdBefore + 1);
    expect(created.slug).toBe("brand-new-piece");
    expect(created.images).toEqual([]);
  });

  it("de-duplicates a colliding slug", async () => {
    const first = await store.createProduct({
      name: "Duplicate Name",
      description: "First.",
      price: "100.00",
      regularPrice: "100.00",
      onSale: false,
      inStock: true,
      categorySlugs: [],
    });
    const second = await store.createProduct({
      name: "Duplicate Name",
      description: "Second.",
      price: "100.00",
      regularPrice: "100.00",
      onSale: false,
      inStock: true,
      categorySlugs: [],
    });

    expect(first.slug).toBe("duplicate-name");
    expect(second.slug).toBe("duplicate-name-2");
  });

  it("resolves categorySlugs into full category objects", async () => {
    const categories = await store.getCategories();
    const targetSlug = categories[0].slug;

    const created = await store.createProduct({
      name: "Categorized Product",
      description: "Has a category.",
      price: "500.00",
      regularPrice: "500.00",
      onSale: false,
      inStock: true,
      categorySlugs: [targetSlug],
    });

    expect(created.categories).toHaveLength(1);
    expect(created.categories[0].slug).toBe(targetSlug);
  });

  it("updates a product's text fields without touching its images", async () => {
    const created = await store.createProduct({
      name: "Has An Image",
      description: "Original.",
      price: "100.00",
      regularPrice: "100.00",
      onSale: false,
      inStock: true,
      categorySlugs: [],
    });
    await store.addProductImage(created.id, {
      id: 1,
      src: "/images/products/test.jpg",
      alt: "Has An Image",
    });

    const updated = await store.updateProduct(created.id, {
      name: "Has An Image",
      description: "Updated description — no images field sent.",
      price: "150.00",
      regularPrice: "150.00",
      onSale: false,
      inStock: true,
      categorySlugs: [],
    });

    expect(updated?.description).toBe("Updated description — no images field sent.");
    expect(updated?.images).toHaveLength(1);
    expect(updated?.images[0].src).toBe("/images/products/test.jpg");
  });

  it("returns undefined when updating a product that doesn't exist", async () => {
    const result = await store.updateProduct(999999, {
      name: "Ghost",
      description: "Doesn't exist.",
      price: "1.00",
      regularPrice: "1.00",
      onSale: false,
      inStock: true,
      categorySlugs: [],
    });
    expect(result).toBeUndefined();
  });

  it("deletes a product", async () => {
    const created = await store.createProduct({
      name: "Temporary",
      description: "Will be deleted.",
      price: "1.00",
      regularPrice: "1.00",
      onSale: false,
      inStock: true,
      categorySlugs: [],
    });

    const deleted = await store.deleteProduct(created.id);
    expect(deleted).toBe(true);

    const products = await store.getProducts();
    expect(products.find((p) => p.id === created.id)).toBeUndefined();
  });

  it("returns false when deleting a product that doesn't exist", async () => {
    expect(await store.deleteProduct(999999)).toBe(false);
  });
});

describe("catalogStore product images", () => {
  it("adds and removes images for a product", async () => {
    const created = await store.createProduct({
      name: "Image Test Product",
      description: "For image tests.",
      price: "100.00",
      regularPrice: "100.00",
      onSale: false,
      inStock: true,
      categorySlugs: [],
    });

    const afterAdd = await store.addProductImage(created.id, {
      id: 1,
      src: "/images/products/a.jpg",
      alt: "a",
    });
    expect(afterAdd?.images).toHaveLength(1);

    const removeResult = await store.removeProductImage(created.id, 1);
    expect(removeResult?.removedImage.src).toBe("/images/products/a.jpg");
    expect(removeResult?.product.images).toHaveLength(0);
  });
});

describe("catalogStore category CRUD", () => {
  it("creates a category with a derived slug", async () => {
    const created = await store.createCategory({ name: "Festival Specials" });
    expect(created.slug).toBe("festival-specials");
  });

  it("unassigns a deleted category from products rather than breaking them", async () => {
    const category = await store.createCategory({ name: "Temp Category" });
    const product = await store.createProduct({
      name: "Product In Temp Category",
      description: "Test.",
      price: "100.00",
      regularPrice: "100.00",
      onSale: false,
      inStock: true,
      categorySlugs: [category.slug],
    });
    expect(product.categories).toHaveLength(1);

    const deleted = await store.deleteCategory(category.id);
    expect(deleted).toBe(true);

    const products = await store.getProducts();
    const survivingProduct = products.find((p) => p.id === product.id);
    expect(survivingProduct).toBeDefined();
    expect(survivingProduct?.categories).toHaveLength(0);
  });

  it("returns false when deleting a category that doesn't exist", async () => {
    expect(await store.deleteCategory(999999)).toBe(false);
  });
});
