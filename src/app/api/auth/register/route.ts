import { NextResponse } from "next/server";
import { createAuthToken, createCustomer, createSession } from "@/lib/auth/customers";
import { limitAttempts, readJson } from "@/lib/auth/guard";
import { sessionCookieHeader } from "@/lib/auth/session";
import { cleanEmail, cleanName, validatePassword } from "@/lib/auth/validation";
import { siteConfig } from "@/lib/config/site";
import { sendEmail } from "@/lib/email/send";
import { verifyEmailEmail } from "@/lib/email/templates";

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

  const customer = await createCustomer({ email, name, password: body.password as string });
  if (customer === "email_taken") {
    return NextResponse.json({ error: "email_taken" }, { status: 409 });
  }

  const verifyToken = await createAuthToken(customer.id, "verify-email");
  const url = `${siteConfig.url}/account/verify-email?token=${verifyToken}`;
  const mail = verifyEmailEmail(customer.name, url);
  await sendEmail({ to: customer.email, ...mail });

  const session = await createSession(customer.id);
  const response = NextResponse.json({ customer }, { status: 201 });
  response.headers.append("Set-Cookie", sessionCookieHeader(session));
  return response;
}
