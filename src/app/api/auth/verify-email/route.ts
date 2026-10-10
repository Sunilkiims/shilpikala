import { NextResponse } from "next/server";
import { consumeAuthToken, markEmailVerified } from "@/lib/auth/customers";
import { limitAttempts, readJson } from "@/lib/auth/guard";

export async function POST(request: Request) {
  const limited = limitAttempts(request, "verify-email", 20, 60 * 60 * 1000);
  if (limited) return limited;

  const body = await readJson(request);
  if (!body || typeof body.token !== "string") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const customerId = await consumeAuthToken(body.token, "verify-email");
  if (!customerId) return NextResponse.json({ error: "invalid_or_expired_token" }, { status: 400 });

  await markEmailVerified(customerId);
  return NextResponse.json({ ok: true });
}
