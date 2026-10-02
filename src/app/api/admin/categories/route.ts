import { NextResponse } from "next/server";
import { createCategory } from "@/lib/store/catalogStore";
import { parseCategoryInput } from "@/lib/store/validation";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = parseCategoryInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const category = await createCategory(parsed.value);
  return NextResponse.json({ category }, { status: 201 });
}
