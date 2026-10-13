import { NextResponse } from "next/server";
import { refreshAfter } from "@/lib/cache/revalidate";
import { saveCollection } from "@/lib/ads/store";
import { parseCollection } from "@/lib/ads/collectionInput";

async function postHandler(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const parsed = await parseCollection(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  return NextResponse.json({ collection: await saveCollection(parsed.value) }, { status: 201 });
}
export const POST = refreshAfter(postHandler);
