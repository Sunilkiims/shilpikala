import { NextResponse } from "next/server";
import { listAddresses, setDefaultAddress } from "@/lib/account/addressStore";
import { getCustomerFromRequest } from "@/lib/auth/session";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const customer = await getCustomerFromRequest(request);
  if (!customer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0 || !(await setDefaultAddress(customer.id, id))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ addresses: await listAddresses(customer.id) });
}
