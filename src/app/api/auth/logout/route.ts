import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/auth/customers";
import { clearSessionCookieHeader, sessionTokenFromRequest } from "@/lib/auth/session";

export async function POST(request: Request) {
  const token = sessionTokenFromRequest(request);
  if (token) await deleteSession(token);
  const response = NextResponse.json({ ok: true });
  response.headers.append("Set-Cookie", clearSessionCookieHeader());
  return response;
}
