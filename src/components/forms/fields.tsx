import { cn } from "@/lib/utils/cn";

export const fieldClass =
  "mt-1.5 w-full border border-earth-brown/25 bg-transparent px-3 py-2.5 text-sm text-charcoal outline-none focus-visible:border-terracotta";

type FieldProps = {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
};

/** Label + control wrapper. The control is a child so it stays a plain native input. */
export function Field({ label, hint, className, children }: FieldProps) {
  return (
    <label className={cn("block", className)}>
      <span className="text-sm text-earth-brown/80">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-earth-brown/70">{hint}</span>}
    </label>
  );
}

export function FormMessage({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: React.ReactNode;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "text-sm",
        tone === "error" ? "text-terracotta-deep" : "text-olive"
      )}
    >
      {children}
    </p>
  );
}

const ERROR_TEXT: Record<string, string> = {
  rate_limited: "Too many attempts. Please wait a few minutes and try again.",
  invalid_email: "Please enter a valid email address.",
  invalid_name: "Please enter your name.",
  password_too_short: "Password must be at least 8 characters.",
  password_too_long: "That password is too long.",
  email_taken: "An account with this email already exists. Try signing in.",
  invalid_code: "That code isn't right. Check the email and try again.",
  expired: "That code has expired. Request a new one.",
  too_many_attempts: "Too many wrong codes. Request a new code to try again.",
  cooldown: "Please wait a moment before requesting another code.",
  otp_limit: "You've requested too many codes. Please try again in a while.",
  email_failed: "We couldn't send the email right now. Please try again in a moment.",
  invalid_credentials: "That email and password don't match.",
  invalid_or_expired_token: "This link is invalid or has expired. Please request a new one.",
  message_too_short: "Please write a little more (at least 10 characters).",
  invalid_address: "Please complete all required address fields.",
  address_limit: "You can save up to 3 addresses. Delete one to add another.",
  wrong_password: "Your current password isn't right.",
  unauthorized: "Please sign in again to continue.",
  not_found: "That item no longer exists. Please refresh the page.",
};

export function errorText(code: string | undefined): string {
  return (code && ERROR_TEXT[code]) || "Something went wrong. Please try again.";
}
