import { NextResponse } from "next/server";
import { createAuthToken, getCustomerByEmail } from "@/lib/auth/customers";
import { limitAttempts, readJson } from "@/lib/auth/guard";
import { cleanEmail } from "@/lib/auth/validation";
import { siteConfig } from "@/lib/config/site";
import { sendEmail } from "@/lib/email/send";
import { passwordResetEmail } from "@/lib/email/templates";

/** Always answers the same way, so it can't be used to discover which emails have accounts. */
export async function POST(request: Request) {
  const limited = limitAttempts(request, "forgot-password", 5, 60 * 60 * 1000);
  if (limited) return limited;

  const body = await readJson(request);
  const email = body ? cleanEmail(body.email) : null;
  if (!email) return NextResponse.json({ error: "invalid_email" }, { status: 400 });

  const customer = await getCustomerByEmail(email);
  if (customer) {
    const token = await createAuthToken(customer.id, "reset-password");
    const mail = passwordResetEmail(`${siteConfig.url}/account/reset-password?token=${token}`);
    await sendEmail({ to: customer.email, ...mail });
  }
  return NextResponse.json({ ok: true });
}
