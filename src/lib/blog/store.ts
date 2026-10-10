import { getDb } from "@/lib/db";
import { iso, num, isUniqueViolation } from "@/lib/db/rows";
import { uniqueSlug } from "@/lib/utils/slugify";

export type BlogPost = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  published: boolean;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
};

type Row = {
  id: number; slug: string; title: string; excerpt: string; body: string; published: boolean;
  published_at: Date | string | null; created_at: Date | string; updated_at: Date | string;
};

const toPost = (r: Row): BlogPost => ({
  id: num(r.id),
  slug: r.slug,
  title: r.title,
  excerpt: r.excerpt,
  body: r.body,
  published: r.published,
  ...(r.published_at ? { publishedAt: iso(r.published_at) } : {}),
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at),
});

export type BlogPostInput = {
  title: string;
  excerpt: string;
  body: string;
  published: boolean;
  slug?: string;
};

export async function listPublishedPosts(): Promise<BlogPost[]> {
  const db = await getDb();
  const res = await db.query<Row>(
    "SELECT * FROM blog_posts WHERE published ORDER BY published_at DESC, id DESC"
  );
  return res.rows.map(toPost);
}

export async function getPublishedPostBySlug(slug: string): Promise<BlogPost | undefined> {
  const db = await getDb();
  const res = await db.query<Row>("SELECT * FROM blog_posts WHERE published AND slug = $1", [slug]);
  return res.rows[0] ? toPost(res.rows[0]) : undefined;
}

export async function listAllPosts(): Promise<BlogPost[]> {
  const db = await getDb();
  const res = await db.query<Row>("SELECT * FROM blog_posts ORDER BY created_at DESC, id DESC");
  return res.rows.map(toPost);
}

export async function getPostById(id: number): Promise<BlogPost | undefined> {
  const db = await getDb();
  const res = await db.query<Row>("SELECT * FROM blog_posts WHERE id = $1", [id]);
  return res.rows[0] ? toPost(res.rows[0]) : undefined;
}

export async function createPost(input: BlogPostInput): Promise<BlogPost> {
  const db = await getDb();
  // Retry on the (rare) race where two posts pick the same slug at once.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.transaction(async (tx) => {
        const taken = await tx.query<{ slug: string }>("SELECT slug FROM blog_posts");
        const slug = uniqueSlug(input.slug || input.title, taken.rows.map((r) => r.slug));
        const res = await tx.query<Row>(
          `INSERT INTO blog_posts (slug, title, excerpt, body, published, published_at)
           VALUES ($1,$2,$3,$4,$5, CASE WHEN $5 THEN now() ELSE NULL END) RETURNING *`,
          [slug, input.title, input.excerpt, input.body, input.published]
        );
        return toPost(res.rows[0]);
      });
    } catch (error) {
      if (!isUniqueViolation(error) || attempt === 2) throw error;
    }
  }
  throw new Error("unreachable");
}

export async function updatePost(id: number, input: BlogPostInput): Promise<BlogPost | undefined> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const existing = await tx.query<Row>("SELECT * FROM blog_posts WHERE id = $1", [id]);
    if (!existing.rows[0]) return undefined;
    let slug = existing.rows[0].slug;
    if (input.slug && input.slug !== slug) {
      const others = await tx.query<{ slug: string }>("SELECT slug FROM blog_posts WHERE id <> $1", [id]);
      slug = uniqueSlug(input.slug, others.rows.map((r) => r.slug));
    }
    // published_at is set the first time a post goes live and then kept.
    const res = await tx.query<Row>(
      `UPDATE blog_posts SET slug=$2, title=$3, excerpt=$4, body=$5, published=$6,
         published_at = CASE WHEN $6 AND published_at IS NULL THEN now() ELSE published_at END,
         updated_at = now()
       WHERE id=$1 RETURNING *`,
      [id, slug, input.title, input.excerpt, input.body, input.published]
    );
    return toPost(res.rows[0]);
  });
}

export async function deletePost(id: number): Promise<boolean> {
  const db = await getDb();
  const res = await db.query("DELETE FROM blog_posts WHERE id = $1", [id]);
  return res.rowCount > 0;
}
