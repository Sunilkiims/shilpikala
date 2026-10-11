import { NextResponse } from "next/server";
import { getCustomerByEmail } from "@/lib/auth/customers";
import { limitAttempts, readJson } from "@/lib/auth/guard";
import { hashPassword } from "@/lib/auth/password";
import { cleanEmail, cleanName, validatePassword } from "@/lib/auth/validation";
import {
  issueCode, otpConfigured, releaseCooldown, sendAccountExistsEmail, sendOtpEmail,
  OTP_RESEND_COOLDOWN_MS, OTP_TTL_MS,
} from "@/lib/auth/otp";

/**
 * Step 1 of sign-up: validate, then email a six-digit code. No account is
 * created yet — that happens in /api/auth/register/verify.
 *
 * The answer is the same whether or not the address already has an account
 * (an existing owner gets a "you already have an account" email instead of a
 * code), so this endpoint can't be used to discover who is registered.
 */
export async function POST(request: Request) {
  const limited = limitAttempts(request, "register", 10, 60 * 60 * 1000);
  if (limited) return limited;

  const body = await readJson(request);
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const email = cleanEmail(body.email);
  const name = cleanName(body.name);
  const passwordError = validatePassword(body.password);
  if (!email) return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "invalid_name" }, { status: 400 });
  if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });

  if (!otpConfigured()) {
    console.error("[otp] Cannot register: email sending is not configured (RESEND_API_KEY + ACCOUNT_EMAIL_FROM).");
    return NextResponse.json({ error: "email_failed" }, { status: 503 });
  }

  // Hash first, so every branch below costs about the same time.
  const passwordHash = await hashPassword(body.password as string);
  const accepted = {
    status: "otp_sent",
    email,
    expiresInSeconds: OTP_TTL_MS / 1000,
    resendInSeconds: OTP_RESEND_COOLDOWN_MS / 1000,
  };

  const existing = await getCustomerByEmail(email);
  if (existing?.emailVerified) {
    await sendAccountExistsEmail(email, existing.name);
    return NextResponse.json(accepted);
  }

  const issued = await issueCode({ email, name, passwordHash });
  if (issued.status === "limit") {
    return NextResponse.json(
      { error: "otp_limit", retryAfterSeconds: issued.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(issued.retryAfterSeconds) } }
    );
  }
  if (issued.status === "cooldown") {
    // A code went out moments ago (double-click, page reload): don't send another.
    return NextResponse.json({ ...accepted, resendInSeconds: issued.retryAfterSeconds });
  }

  if (!(await sendOtpEmail(email, name, issued.code))) {
    await releaseCooldown(email);
    return NextResponse.json({ error: "email_failed" }, { status: 502 });
  }
  return NextResponse.json(accepted);
}
