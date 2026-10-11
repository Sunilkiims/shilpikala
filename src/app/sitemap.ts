import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/config/site";
import { getAllCategories, getAllProducts } from "@/lib/catalog";
import { listPublishedPosts } from "@/lib/blog/store";

export const revalidate = 3600;

const staticPaths = [
  "/",
  "/shop",
  "/about",
  "/contact",
  "/custom-art",
  "/blog",
  "/faq",
  "/shipping",
  "/returns",
  "/return-refund-policy",
  "/privacy",
  "/terms",
  "/track-order",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, posts] = await Promise.all([
    getAllProducts(),
    getAllCategories(),
    listPublishedPosts(),
  ]);
  const url = (path: string) => `${siteConfig.url}${path}`;

  return [
    ...staticPaths.map((path) => ({ url: url(path), lastModified: new Date() })),
    ...categories.map((c) => ({ url: url(`/categories/${c.slug}`) })),
    ...products.map((p) => ({ url: url(`/product/${p.slug}`) })),
    ...posts.map((p) => ({ url: url(`/blog/${p.slug}`), lastModified: new Date(p.updatedAt) })),
  ];
}
