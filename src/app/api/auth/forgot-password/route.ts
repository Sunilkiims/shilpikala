import { NextResponse } from "next/server";
import { createAuthToken, getCustomerByEmail } from "@/lib/auth/customers";
import { limitAttempts, readJson } from "@/lib/auth/guard";
import { cleanEmail } from "@/lib/auth/validation";
import { emailLink } from "@/lib/config/emailLinks";
import { randomUUID } from "node:crypto";
import { senderFor } from "@/lib/email/config";
import { deliver } from "@/lib/email/outbox";
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
    // Sent from the dedicated reset sender. Each request is its own email.
    await deliver({
      kind: "password-reset",
      key: `password-reset:${customer.id}:${randomUUID()}`,
      to: customer.email,
      from: senderFor("account"),
      ...passwordResetEmail(emailLink(`/account/reset-password?token=${token}`)),
      customerId: customer.id,
    }).catch((error) => console.error("[email] Password reset email failed:", error));
  }
  return NextResponse.json({ ok: true });
}
