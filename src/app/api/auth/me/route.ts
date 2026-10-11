import { NextResponse } from "next/server";
import { getCustomerFromRequest } from "@/lib/auth/session";

/**
 * The menu asks who is signed in. Returns only what it displays (the
 * person's own name and email, from their own session cookie) — never
 * the address, phone or anything cacheable.
 */
export async function GET(request: Request) {
  const customer = await getCustomerFromRequest(request);
  return NextResponse.json(
    { customer: customer ? { name: customer.name, email: customer.email } : null },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
