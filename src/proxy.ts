import { NextResponse, type NextRequest } from "next/server";
import { adminConfig, isAdminConfigured } from "@/lib/admin/config";
import { getClientIp } from "@/lib/security/getClientIp";
import {
  isRateLimited,
  recordAttempt,
  secondsUntilReset,
} from "@/lib/security/rateLimiter";

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

const LOGIN_ATTEMPT_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function unauthorized(): NextResponse {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="ShilpiKala Admin"' },
  });
}

function tooManyAttempts(retryAfterSeconds: number): NextResponse {
  return new NextResponse(
    "Too many failed login attempts. Please wait before trying again.",
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}

/**
 * Fails closed: if ADMIN_USERNAME/ADMIN_PASSWORD aren't set, the admin
 * area is blocked entirely rather than left open. This matches the same
 * "never crash, never silently allow" pattern as the Razorpay
 * fallbacks elsewhere in the app.
 *
 * Only *failed* credential attempts count against the rate limit — not
 * the credential-less first request every browser sends before showing
 * its login prompt, and not successful logins. That keeps the budget
 * meaningful for blocking guessing without punishing normal use.
 */
export function proxy(request: NextRequest): NextResponse {
  if (!isAdminConfigured()) {
    return new NextResponse(
      "The admin area isn't configured yet. Set ADMIN_USERNAME and ADMIN_PASSWORD.",
      { status: 503 }
    );
  }

  const rateLimitKey = `admin-login:${getClientIp(request)}`;
  if (isRateLimited(rateLimitKey, LOGIN_ATTEMPT_LIMIT, LOGIN_WINDOW_MS)) {
    return tooManyAttempts(secondsUntilReset(rateLimitKey, LOGIN_WINDOW_MS));
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
    recordAttempt(rateLimitKey, LOGIN_WINDOW_MS);
    return unauthorized();
  }

  if (username !== adminConfig.username || password !== adminConfig.password) {
    recordAttempt(rateLimitKey, LOGIN_WINDOW_MS);
    return unauthorized();
  }

  return NextResponse.next();
}
