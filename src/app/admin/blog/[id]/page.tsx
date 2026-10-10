import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { BlogForm } from "@/components/admin/BlogForm";
import { getPostById } from "@/lib/blog/store";

export const metadata: Metadata = { title: "Edit post — Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function EditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const post = Number.isInteger(id) ? await getPostById(id) : undefined;
  if (!post) notFound();
  return (
    <Container className="py-12 sm:py-16">
      <h1 className="mb-8 text-3xl text-charcoal">Edit post</h1>
      <BlogForm post={post} />
    </Container>
  );
}
