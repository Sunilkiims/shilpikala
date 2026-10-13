import { NextResponse } from "next/server";
import { refreshAfter } from "@/lib/cache/revalidate";
import { saveSettings } from "@/lib/ads/store";

async function putHandler(request: Request) {
  let b: Record<string, unknown>;
  try { b = (await request.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const secs = b?.heroIntervalSeconds;
  if (typeof b?.heroAutoplay !== "boolean" || typeof secs !== "number" || !Number.isInteger(secs) || secs < 3 || secs > 30) {
    return NextResponse.json({ error: "invalid_settings" }, { status: 400 });
  }
  await saveSettings({ heroAutoplay: b.heroAutoplay, heroIntervalSeconds: secs });
  return NextResponse.json({ ok: true });
}
export const PUT = refreshAfter(putHandler);
