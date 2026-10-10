import { refreshAfter } from "@/lib/cache/revalidate";
import { NextResponse } from "next/server";
import { readJson } from "@/lib/auth/guard";
import { createPost } from "@/lib/blog/store";
import { validateBlogPost } from "@/lib/blog/validation";

async function postHandler(request: Request) {
  const body = await readJson(request);
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const result = validateBlogPost(body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ post: await createPost(result.value) }, { status: 201 });
}

export const POST = refreshAfter(postHandler);
