import type { Metadata } from "next";
import Link from "next/link";
import { buildMetadata } from "@/lib/seo/metadata";
import { Container } from "@/components/ui/Container";
import { listPublishedPosts } from "@/lib/blog/store";

export const revalidate = 300;

export const metadata: Metadata = buildMetadata({
  title: "Journal",
  description: "Stories from the studio — Mandala, Lipan and the craft behind each piece.",
  path: "/blog",
});

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { dateStyle: "long" });
}

export default async function BlogPage() {
  const posts = await listPublishedPosts();

  return (
    <Container className="py-12 sm:py-16">
      <h1 className="text-3xl text-charcoal sm:text-4xl">Journal</h1>
      <p className="mt-4 max-w-xl text-base leading-relaxed text-earth-brown/85">
        Stories from the studio — the craft, the process and the traditions behind each piece.
      </p>

      {posts.length === 0 ? (
        <p className="mt-12 text-sm text-earth-brown/70">
          The first stories are on their way. In the meantime, <Link href="/shop" className="text-terracotta underline underline-offset-2 hover:text-terracotta-deep">explore the shop</Link>.
        </p>
      ) : (
        <ul className="mt-12 grid gap-10 sm:grid-cols-2">
          {posts.map((post) => (
            <li key={post.id} className="border-t border-earth-brown/20 pt-5">
              {post.publishedAt && (
                <p className="text-xs text-earth-brown/70">
                  <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
                </p>
              )}
              <h2 className="mt-2 text-2xl text-charcoal">
                <Link href={`/blog/${post.slug}`} className="hover:text-terracotta">
                  {post.title}
                </Link>
              </h2>
              {post.excerpt && (
                <p className="mt-2 text-sm leading-relaxed text-earth-brown/80">{post.excerpt}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
