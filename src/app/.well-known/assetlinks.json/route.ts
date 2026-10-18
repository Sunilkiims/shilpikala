import { NextResponse } from "next/server";
import { buildAssetLinks } from "@/lib/android/assetLinks";

// Read the environment on every request so a new signing fingerprint only
// needs an env change and restart — not a rebuild.
export const dynamic = "force-dynamic";

/**
 * Digital Asset Links for the Android app (/android). Android checks this
 * file to confirm the app and www.shilpikala.com belong to the same owner;
 * when it matches, the app opens the site full screen with no browser bar.
 */
export function GET(): NextResponse {
  const statements = buildAssetLinks({
    ANDROID_PACKAGE_NAME: process.env.ANDROID_PACKAGE_NAME,
    ANDROID_SHA256_CERT_FINGERPRINTS: process.env.ANDROID_SHA256_CERT_FINGERPRINTS,
  });
  return NextResponse.json(statements, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
