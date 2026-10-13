import { NextResponse } from "next/server";
import { updateProfile } from "@/lib/auth/customers";
import { readJson } from "@/lib/auth/guard";
import { getCustomerFromRequest } from "@/lib/auth/session";
import { cleanName } from "@/lib/auth/validation";

export async function PATCH(request: Request) {
  const customer = await getCustomerFromRequest(request);
  if (!customer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await readJson(request);
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const name = cleanName(body.name);
  if (!name) return NextResponse.json({ error: "invalid_name" }, { status: 400 });

  const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 30) : undefined;

  const updated = await updateProfile(customer.id, { name, phone });
  return NextResponse.json({ customer: updated });
}
