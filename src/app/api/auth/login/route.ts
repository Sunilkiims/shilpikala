import { NextResponse } from "next/server";
import { authenticate, createSession } from "@/lib/auth/customers";
import { limitAttempts, readJson } from "@/lib/auth/guard";
import { sessionCookieHeader } from "@/lib/auth/session";

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

  const session = await createSession(customer.id);
  const response = NextResponse.json({ customer });
  response.headers.append("Set-Cookie", sessionCookieHeader(session));
  return response;
}
