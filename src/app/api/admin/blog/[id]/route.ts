import { refreshAfter } from "@/lib/cache/revalidate";
import { NextResponse } from "next/server";
import { readJson } from "@/lib/auth/guard";
import { deletePost, updatePost } from "@/lib/blog/store";
import { validateBlogPost } from "@/lib/blog/validation";

type RouteParams = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function patchHandler(request: Request, { params }: RouteParams) {
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const body = await readJson(request);
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const result = validateBlogPost(body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  const post = await updatePost(id, result.value);
  if (!post) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ post });
}

async function deleteHandler(_request: Request, { params }: RouteParams) {
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  if (!(await deletePost(id))) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export const PATCH = refreshAfter(patchHandler);
export const DELETE = refreshAfter(deleteHandler);
