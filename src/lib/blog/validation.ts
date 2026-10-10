import type { BlogPostInput } from "@/lib/blog/store";
import { slugify } from "@/lib/utils/slugify";

export function validateBlogPost(
  body: Record<string, unknown>
): { ok: true; value: BlogPostInput } | { ok: false; error: string } {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (title.length < 1 || title.length > 200) return { ok: false, error: "invalid_title" };
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (text.length < 1 || text.length > 50_000) return { ok: false, error: "invalid_body_text" };
  const excerpt = typeof body.excerpt === "string" ? body.excerpt.trim().slice(0, 300) : "";
  if (typeof body.published !== "boolean") return { ok: false, error: "invalid_published" };
  const slug = typeof body.slug === "string" && body.slug.trim() ? slugify(body.slug) : undefined;
  return { ok: true, value: { title, excerpt, body: text, published: body.published, ...(slug ? { slug } : {}) } };
}
