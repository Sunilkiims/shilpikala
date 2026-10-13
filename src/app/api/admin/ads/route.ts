import { NextResponse } from "next/server";
import { refreshAfter } from "@/lib/cache/revalidate";
import { createAd } from "@/lib/ads/store";
import { parseAdInput } from "@/lib/ads/validate";

// Every /api/admin/* request is gated by proxy.ts (HTTP Basic auth, fails closed, rate limited).
async function postHandler(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const parsed = await parseAdInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error, field: parsed.field }, { status: 400 });
  return NextResponse.json({ ad: await createAd(parsed.value) }, { status: 201 });
}
export const POST = refreshAfter(postHandler);
