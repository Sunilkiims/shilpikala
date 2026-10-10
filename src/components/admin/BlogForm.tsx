"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, FormMessage, fieldClass } from "@/components/forms/fields";

type Props = {
  post?: { id: number; title: string; slug: string; excerpt: string; body: string; published: boolean };
};

export function BlogForm({ post }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch(post ? `/api/admin/blog/${post.id}` : "/api/admin/blog", {
        method: post ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.get("title"),
          slug: data.get("slug"),
          excerpt: data.get("excerpt"),
          body: data.get("body"),
          published: data.get("published") === "on",
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(`Couldn't save (${body.error ?? response.status}).`);
        setBusy(false);
        return;
      }
      router.push("/admin/blog");
      router.refresh();
    } catch {
      setError("Couldn't save. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-2xl gap-5">
      <Field label="Title"><input name="title" required maxLength={200} defaultValue={post?.title} className={fieldClass} /></Field>
      <Field label="URL slug (optional)" hint="Leave blank to generate from the title."><input name="slug" defaultValue={post?.slug} className={fieldClass} /></Field>
      <Field label="Excerpt" hint="Shown on the journal list and in search results (max 300 characters)."><textarea name="excerpt" rows={2} maxLength={300} defaultValue={post?.excerpt} className={fieldClass} /></Field>
      <Field label="Body" hint="Plain text. Separate paragraphs with a blank line; start a line with “## ” for a heading."><textarea name="body" required rows={16} defaultValue={post?.body} className={fieldClass} /></Field>
      <label className="flex items-center gap-2 text-sm text-earth-brown/80">
        <input type="checkbox" name="published" defaultChecked={post?.published} /> Published (visible on the site)
      </label>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <div><Button type="submit" disabled={busy}>{busy ? "Saving…" : post ? "Save changes" : "Create post"}</Button></div>
    </form>
  );
}
