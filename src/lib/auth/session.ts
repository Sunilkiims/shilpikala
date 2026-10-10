import { cookies } from "next/headers";
import { getCustomerBySession, SESSION_TTL_MS, type CustomerAccount } from "@/lib/auth/customers";

export const SESSION_COOKIE = "sk_session";

function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return undefined;
}

/** For route handlers (works with a plain Request, so it's easy to test). */
export async function getCustomerFromRequest(request: Request): Promise<CustomerAccount | undefined> {
  return getCustomerBySession(readCookie(request.headers.get("cookie"), SESSION_COOKIE));
}

export function sessionTokenFromRequest(request: Request): string | undefined {
  return readCookie(request.headers.get("cookie"), SESSION_COOKIE);
}

/** For Server Components / server actions. */
export async function getCurrentCustomer(): Promise<CustomerAccount | undefined> {
  const store = await cookies();
  return getCustomerBySession(store.get(SESSION_COOKIE)?.value);
}

function secureFlag(): string {
  return process.env.NODE_ENV === "production" ? "; Secure" : "";
}

export function sessionCookieHeader(token: string): string {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureFlag()}`;
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag()}`;
}
