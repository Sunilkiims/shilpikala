import { NextResponse } from "next/server";
import { authenticate, createSession } from "@/lib/auth/customers";
import { limitAttempts, readJson } from "@/lib/auth/guard";
import { sessionCookieHeader } from "@/lib/auth/session";
import { OTP_RESEND_COOLDOWN_MS, OTP_TTL_MS, issueCodeForExistingAccount, releaseCooldown, sendOtpEmail } from "@/lib/auth/otp";

export async function POST(request: Request) {
  const limited = limitAttempts(request, "customer-login", 15, 15 * 60 * 1000);
  if (limited) return limited;

  const body = await readJson(request);
  if (!body || typeof body.email !== "string" || typeof body.password !== "string") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const customer = await authenticate(body.email, body.password);
  // One generic answer for "no such account" and "wrong password".
  if (!customer) return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });

  // Accounts that were never verified can't sign in (or reach any account
  // feature) until the emailed code is entered. Only someone who knows the
  // password gets a code sent, so this can't be used to spam an address.
  if (!customer.emailVerified) {
    const issued = await issueCodeForExistingAccount(customer.email);
    const pending = {
      error: "email_not_verified",
      email: customer.email,
      expiresInSeconds: OTP_TTL_MS / 1000,
      resendInSeconds: OTP_RESEND_COOLDOWN_MS / 1000,
    };
    if (issued?.status === "issued") {
      if (!(await sendOtpEmail(customer.email, issued.name, issued.code))) {
        await releaseCooldown(customer.email);
        return NextResponse.json({ error: "email_failed" }, { status: 502 });
      }
    } else if (issued?.status === "cooldown") {
      pending.resendInSeconds = issued.retryAfterSeconds;
    } else if (issued?.status === "limit") {
      return NextResponse.json({ error: "otp_limit", retryAfterSeconds: issued.retryAfterSeconds }, { status: 429 });
    }
    return NextResponse.json(pending, { status: 403 });
  }

  const session = await createSession(customer.id);
  const response = NextResponse.json({ customer });
  response.headers.append("Set-Cookie", sessionCookieHeader(session));
  return response;
}
