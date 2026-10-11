import { NextResponse } from "next/server";
import { limitAttempts } from "@/lib/auth/guard";
import { getCustomerFromRequest } from "@/lib/auth/session";
import { publicRequest, returnErrorResponse } from "@/lib/returns/http";
import { listReturnsForCustomer } from "@/lib/returns/store";
import { submitReturnRequest } from "@/lib/returns/workflow";
import { ReturnError } from "@/lib/returns/types";

function parseJsonField(value: FormDataEntryValue | null): unknown {
  if (typeof value !== "string" || !value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    throw new ReturnError("invalid_body", 400);
  }
}

/** The signed-in customer's requests. */
export async function GET(request: Request) {
  const customer = await getCustomerFromRequest(request);
  if (!customer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const requests = await listReturnsForCustomer(customer);
  return NextResponse.json({ requests: requests.map(publicRequest) });
}

/**
 * Creates a return / replacement request (multipart: fields + up to 5 images and an optional video).
 * Ownership, the 7-day window, per-product policy and duplicate quantities are all re-checked here.
 */
export async function POST(request: Request) {
  const customer = await getCustomerFromRequest(request);
  if (!customer) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const limited = limitAttempts(request, "return-submit", 10, 15 * 60 * 1000);
  if (limited) return limited;

  try {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new ReturnError("invalid_body", 400);
    }
    const files: { name: string; data: Buffer }[] = [];
    for (const entry of form.getAll("evidence")) {
      if (typeof entry === "string") continue;
      files.push({ name: entry.name, data: Buffer.from(await entry.arrayBuffer()) });
    }
    const created = await submitReturnRequest(customer, {
      orderReference: String(form.get("orderId") ?? ""),
      type: form.get("type"),
      reason: form.get("reason"),
      description: form.get("description"),
      items: parseJsonField(form.get("items")),
      pickupAddress: parseJsonField(form.get("pickupAddress")),
      refundMethod: form.get("refundMethod") ?? undefined,
      payout: parseJsonField(form.get("payout")),
      files,
    });
    return NextResponse.json({ request: { id: created.id, status: created.status, type: created.type } }, { status: 201 });
  } catch (error) {
    return returnErrorResponse(error);
  }
}
