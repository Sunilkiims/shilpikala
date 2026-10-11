import { NextResponse } from "next/server";
import { getCustomerFromRequest } from "@/lib/auth/session";
import { publicRequest } from "@/lib/returns/http";
import { currentRefund } from "@/lib/returns/refunds";
import { getShipmentForRequest } from "@/lib/returns/replacements";
import { getReturnRequest, getStatusHistory, listEvidence } from "@/lib/returns/store";
import { customerOwnsRequest } from "@/lib/returns/workflow";

type RouteParams = { params: Promise<{ id: string }> };

/** One of the customer's own requests with its history. Someone else's answers 404, like a missing one. */
export async function GET(request: Request, { params }: RouteParams) {
  const customer = await getCustomerFromRequest(request);
  if (!customer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const found = await getReturnRequest(id);
  if (!found || !customerOwnsRequest(customer, found)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const [history, evidence, refund, shipment] = await Promise.all([
    getStatusHistory(id), listEvidence(id), currentRefund(id), getShipmentForRequest(id),
  ]);
  return NextResponse.json({
    request: publicRequest(found),
    history,
    evidence,
    refund: refund ? { amountPaise: refund.amountPaise, status: refund.status, reference: refund.razorpayRefundId ?? refund.payoutReference } : null,
    shipment,
  });
}
