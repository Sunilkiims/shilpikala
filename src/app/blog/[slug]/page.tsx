import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { PostBody } from "@/components/blog/PostBody";
import { getPublishedPostBySlug } from "@/lib/blog/store";
import { siteConfig } from "@/lib/config/site";

export const revalidate = 300;
// Posts published after the build are rendered on first request.
export const dynamicParams = true;

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) return {};
  return buildMetadata({
    title: post.title,
    description: post.excerpt || undefined,
    path: `/blog/${post.slug}`,
  });
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) notFound();

  const structured = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt || undefined,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    mainEntityOfPage: `${siteConfig.url}/blog/${post.slug}`,
    author: { "@type": "Organization", name: siteConfig.name },
    publisher: { "@type": "Organization", name: siteConfig.name },
  };

  return (
    <Container className="py-12 sm:py-16">
      <JsonLd data={structured} />
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Journal", href: "/blog" },
          { label: post.title },
        ]}
      />
      <article className="mt-8 max-w-2xl">
        <h1 className="text-3xl text-charcoal sm:text-4xl">{post.title}</h1>
        {post.publishedAt && (
          <p className="mt-3 text-xs text-earth-brown/70">
            <time dateTime={post.publishedAt}>
              {new Date(post.publishedAt).toLocaleDateString("en-IN", { dateStyle: "long" })}
            </time>
          </p>
        )}
        <div className="mt-8">
          <PostBody body={post.body} />
        </div>
      </article>
    </Container>
  );
}
