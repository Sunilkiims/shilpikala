import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { BlogForm } from "@/components/admin/BlogForm";

export const metadata: Metadata = { title: "New post — Admin", robots: { index: false, follow: false } };

export default function NewBlogPostPage() {
  return (
    <Container className="py-12 sm:py-16">
      <h1 className="mb-8 text-3xl text-charcoal">New post</h1>
      <BlogForm />
    </Container>
  );
}
