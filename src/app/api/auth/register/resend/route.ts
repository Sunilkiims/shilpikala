import { NextResponse } from "next/server";
import { limitAttempts, readJson } from "@/lib/auth/guard";
import { cleanEmail } from "@/lib/auth/validation";
import {
  OTP_RESEND_COOLDOWN_MS, OTP_TTL_MS, reissueCode, releaseCooldown, sendOtpEmail,
} from "@/lib/auth/otp";

/** "Resend code": a fresh code replaces the old one (which stops working). One per minute, five per hour. */
export async function POST(request: Request) {
  const limited = limitAttempts(request, "otp-resend", 10, 60 * 60 * 1000);
  if (limited) return limited;

  const body = await readJson(request);
  const email = body ? cleanEmail(body.email) : null;
  if (!email) return NextResponse.json({ error: "invalid_email" }, { status: 400 });

  const result = await reissueCode(email);
  const accepted = {
    status: "otp_sent",
    email,
    expiresInSeconds: OTP_TTL_MS / 1000,
    resendInSeconds: OTP_RESEND_COOLDOWN_MS / 1000,
  };
  // Nothing pending (for instance the address already has an account): same answer, nothing sent.
  if (result === "no_pending") return NextResponse.json(accepted);

  if (result.status === "cooldown" || result.status === "limit") {
    return NextResponse.json(
      { error: result.status === "cooldown" ? "cooldown" : "otp_limit", retryAfterSeconds: result.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } }
    );
  }
  if (!(await sendOtpEmail(email, result.name ?? "there", result.code))) {
    await releaseCooldown(email);
    return NextResponse.json({ error: "email_failed" }, { status: 502 });
  }
  return NextResponse.json(accepted);
}
