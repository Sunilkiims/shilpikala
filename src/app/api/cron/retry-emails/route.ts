import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { retryOrderEmails } from "@/lib/orders/orderEmails";

/**
 * Optional safety net: call this every 10–15 minutes (e.g. Vercel Cron,
 * which sends `Authorization: Bearer $CRON_SECRET`) to resend order emails
 * that failed. Disabled unless CRON_SECRET is set.
 */
function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(request: Request) {
  if (!authorised(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await retryOrderEmails();
  return NextResponse.json({ orders: result.orders });
}

export const GET = handle;
export const POST = handle;
