import { NextResponse } from "next/server";
import { changePassword, createSession } from "@/lib/auth/customers";
import { limitAttempts, readJson } from "@/lib/auth/guard";
import { getCustomerFromRequest, sessionCookieHeader } from "@/lib/auth/session";
import { validatePassword } from "@/lib/auth/validation";

/** Change password: needs the current one. All other devices are signed out; this one stays signed in. */
export async function POST(request: Request) {
  const customer = await getCustomerFromRequest(request);
  if (!customer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const limited = limitAttempts(request, "change-password", 8, 15 * 60 * 1000);
  if (limited) return limited;

  const body = await readJson(request);
  if (!body || typeof body.currentPassword !== "string" || typeof body.newPassword !== "string") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const problem = validatePassword(body.newPassword);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  if ((await changePassword(customer.id, body.currentPassword, body.newPassword)) === "wrong_password") {
    return NextResponse.json({ error: "wrong_password" }, { status: 403 });
  }
  const response = NextResponse.json({ ok: true });
  response.headers.append("Set-Cookie", sessionCookieHeader(await createSession(customer.id)));
  return response;
}
