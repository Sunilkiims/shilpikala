import { NextResponse } from "next/server";
import { limitAttempts, readJson } from "@/lib/auth/guard";
import { cleanEmail } from "@/lib/auth/validation";
import { sessionCookieHeader } from "@/lib/auth/session";
import { verifyCode } from "@/lib/auth/otp";
import { emailLink } from "@/lib/config/emailLinks";
import { senderFor } from "@/lib/email/config";
import { deliver } from "@/lib/email/outbox";
import { welcomeEmail } from "@/lib/email/templates";

const STATUS = { invalid_code: 400, expired: 400, too_many_attempts: 429, email_taken: 409 } as const;

/** Step 2 of sign-up: the right code creates the verified account and signs the person in. */
export async function POST(request: Request) {
  const limited = limitAttempts(request, "otp-verify", 30, 15 * 60 * 1000);
  if (limited) return limited;

  const body = await readJson(request);
  const email = body ? cleanEmail(body.email) : null;
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!email) return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: "invalid_code" }, { status: 400 });

  const result = await verifyCode(email, code);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: STATUS[result.error] });
  }

  // Welcome email is best effort: it must never undo a successful verification.
  try {
    await deliver({
      kind: "welcome",
      key: `welcome:${result.customer.id}`,
      to: result.customer.email,
      from: senderFor("account"),
      ...welcomeEmail(result.customer.name, emailLink("/shop")),
      customerId: result.customer.id,
    });
  } catch (error) {
    console.error("[email] Welcome email failed:", (error as Error).message);
  }

  const response = NextResponse.json({ customer: result.customer }, { status: 201 });
  response.headers.append("Set-Cookie", sessionCookieHeader(result.sessionToken));
  return response;
}
