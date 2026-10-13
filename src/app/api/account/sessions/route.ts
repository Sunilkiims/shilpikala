import { NextResponse } from "next/server";
import { deleteOtherSessions } from "@/lib/auth/customers";
import { getCustomerFromRequest, sessionTokenFromRequest } from "@/lib/auth/session";

/** DELETE = sign out of every other device. */
export async function DELETE(request: Request) {
  const customer = await getCustomerFromRequest(request);
  if (!customer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await deleteOtherSessions(customer.id, sessionTokenFromRequest(request));
  return NextResponse.json({ ok: true });
}
