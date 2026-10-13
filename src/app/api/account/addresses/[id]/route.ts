import { NextResponse } from "next/server";
import { deleteAddress, listAddresses, updateAddress } from "@/lib/account/addressStore";
import { readJson } from "@/lib/auth/guard";
import { getCustomerFromRequest } from "@/lib/auth/session";
import { sanitizeAddress } from "@/lib/checkout/address";

type Ctx = { params: Promise<{ id: string }> };
const parseId = async (ctx: Ctx) => {
  const n = Number((await ctx.params).id);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// Every query is filtered by the signed-in customer's id, so another
// customer's address id behaves exactly like one that doesn't exist (404).
export async function PATCH(request: Request, ctx: Ctx) {
  const customer = await getCustomerFromRequest(request);
  if (!customer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = await parseId(ctx);
  const body = await readJson(request);
  const address = body ? sanitizeAddress(body.address) : null;
  if (id === null || !body || !address) return NextResponse.json({ error: "invalid_address" }, { status: 400 });

  const label = typeof body.label === "string" ? body.label.trim().slice(0, 40) : "";
  const saved = await updateAddress(customer.id, id, { address, label, makeDefault: body.isDefault === true });
  if (!saved) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ address: saved, addresses: await listAddresses(customer.id) });
}

export async function DELETE(request: Request, ctx: Ctx) {
  const customer = await getCustomerFromRequest(request);
  if (!customer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = await parseId(ctx);
  if (id === null || !(await deleteAddress(customer.id, id))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ addresses: await listAddresses(customer.id) });
}
