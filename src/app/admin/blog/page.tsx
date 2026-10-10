import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { listAllPosts } from "@/lib/blog/store";

export const metadata: Metadata = { title: "Blog — Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminBlogPage() {
  const posts = await listAllPosts();
  return (
    <Container className="py-12 sm:py-16">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-3xl text-charcoal">Blog</h1>
        <Link href="/admin/blog/new" className="text-sm text-terracotta hover:text-terracotta-deep">New post</Link>
      </div>
      {posts.length === 0 ? (
        <p className="mt-10 text-sm text-earth-brown/70">No posts yet.</p>
      ) : (
        <ul className="mt-8 divide-y divide-earth-brown/15 border-y border-earth-brown/15">
          {posts.map((post) => (
            <li key={post.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <p className="text-sm text-charcoal">{post.title}</p>
                <p className="text-xs text-earth-brown/70">
                  {post.published ? "Published" : "Draft"} · /blog/{post.slug}
                </p>
              </div>
              <div className="flex items-center gap-5">
                <Link href={`/admin/blog/${post.id}`} className="text-xs text-terracotta hover:text-terracotta-deep">Edit</Link>
                <DeleteButton endpoint={`/api/admin/blog/${post.id}`} confirmMessage={`Delete “${post.title}”? This cannot be undone.`} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
