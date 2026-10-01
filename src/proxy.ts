import { NextResponse, type NextRequest } from "next/server";
import { adminConfig, isAdminConfigured } from "@/lib/admin/config";

export const config = {
  matcher: ["/admin/:path*"],
};

function unauthorized(): NextResponse {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="ShilpiKala Admin"' },
  });
}

/**
 * Fails closed: if ADMIN_USERNAME/ADMIN_PASSWORD aren't set, the admin
 * area is blocked entirely rather than left open. This matches the same
 * "never crash, never silently allow" pattern as the WooCommerce and
 * Razorpay fallbacks elsewhere in the app.
 */
export function proxy(request: NextRequest): NextResponse {
  if (!isAdminConfigured()) {
    return new NextResponse(
      "The admin area isn't configured yet. Set ADMIN_USERNAME and ADMIN_PASSWORD.",
      { status: 503 }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Basic ")) {
    return unauthorized();
  }

  let username = "";
  let password = "";
  try {
    const decoded = atob(authHeader.slice("Basic ".length));
    const separatorIndex = decoded.indexOf(":");
    username = decoded.slice(0, separatorIndex);
    password = decoded.slice(separatorIndex + 1);
  } catch {
    return unauthorized();
  }

  if (username !== adminConfig.username || password !== adminConfig.password) {
    return unauthorized();
  }

  return NextResponse.next();
}
