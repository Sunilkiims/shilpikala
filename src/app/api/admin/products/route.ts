import { NextResponse } from "next/server";
import { createProduct } from "@/lib/store/catalogStore";
import { parseProductInput } from "@/lib/store/validation";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = parseProductInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const product = await createProduct(parsed.value);
  return NextResponse.json({ product }, { status: 201 });
}
