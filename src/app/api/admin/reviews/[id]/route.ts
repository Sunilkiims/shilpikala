import { NextResponse } from "next/server";
import { updateReviewStatus } from "@/lib/reviews/store";
import type { ReviewStatus } from "@/lib/reviews/types";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const status = (body as { status?: string })?.status;
  if (status !== "approved" && status !== "rejected") {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  const review = await updateReviewStatus(id, status as ReviewStatus);
  if (!review) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ review });
}
