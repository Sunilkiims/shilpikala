import { NextResponse } from "next/server";
import { consumeAuthToken, markEmailVerified, setPassword } from "@/lib/auth/customers";
import { limitAttempts, readJson } from "@/lib/auth/guard";
import { validatePassword } from "@/lib/auth/validation";

export async function POST(request: Request) {
  const limited = limitAttempts(request, "reset-password", 10, 60 * 60 * 1000);
  if (limited) return limited;

  const body = await readJson(request);
  if (!body || typeof body.token !== "string") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const passwordError = validatePassword(body.password);
  if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });

  const customerId = await consumeAuthToken(body.token, "reset-password");
  if (!customerId) return NextResponse.json({ error: "invalid_or_expired_token" }, { status: 400 });

  await setPassword(customerId, body.password as string);
  // They proved control of the inbox, so the address is verified too.
  await markEmailVerified(customerId);
  return NextResponse.json({ ok: true });
}
