import { NextResponse } from "next/server";
import { addAddress, listAddresses, MAX_ADDRESSES } from "@/lib/account/addressStore";
import { readJson } from "@/lib/auth/guard";
import { getCustomerFromRequest } from "@/lib/auth/session";
import { sanitizeAddress } from "@/lib/checkout/address";

const cleanLabel = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 40) : "");

export async function GET(request: Request) {
  const customer = await getCustomerFromRequest(request);
  if (!customer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ addresses: await listAddresses(customer.id), max: MAX_ADDRESSES });
}

export async function POST(request: Request) {
  const customer = await getCustomerFromRequest(request);
  if (!customer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(request);
  const address = body ? sanitizeAddress(body.address) : null;
  if (!body || !address) return NextResponse.json({ error: "invalid_address" }, { status: 400 });

  const result = await addAddress(customer.id, {
    address,
    label: cleanLabel(body.label),
    makeDefault: body.isDefault === true,
  });
  if (result === "limit_reached") {
    return NextResponse.json({ error: "address_limit", max: MAX_ADDRESSES }, { status: 409 });
  }
  return NextResponse.json({ address: result, addresses: await listAddresses(customer.id) }, { status: 201 });
}
