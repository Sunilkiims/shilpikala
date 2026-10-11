import { NextResponse } from "next/server";
import { getCustomerFromRequest } from "@/lib/auth/session";
import { returnErrorResponse } from "@/lib/returns/http";
import { getReturnRequest } from "@/lib/returns/store";
import { cancelReturnByCustomer, customerOwnsRequest } from "@/lib/returns/workflow";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const customer = await getCustomerFromRequest(request);
  if (!customer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const found = await getReturnRequest(id);
  if (!found || !customerOwnsRequest(customer, found)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  try {
    const updated = await cancelReturnByCustomer(id);
    return NextResponse.json({ status: updated.status });
  } catch (error) {
    return returnErrorResponse(error);
  }
}
