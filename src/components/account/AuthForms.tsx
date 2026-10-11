"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, FormMessage, errorText, fieldClass } from "@/components/forms/fields";

async function post(url: string, body: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) return { ok: true };
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: data.error };
  } catch {
    return { ok: false };
  }
}

function formValues(event: React.FormEvent<HTMLFormElement>): Record<string, string> {
  return Object.fromEntries(
    Array.from(new FormData(event.currentTarget).entries()).map(([k, v]) => [k, String(v)])
  );
}

/** Sign in / create account, switchable in place. */
export function SignInRegister({ initialMode = "login" }: { initialMode?: "login" | "register" } = {}) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = formValues(event);
    setBusy(true);
    setError(undefined);
    const result = await post(mode === "login" ? "/api/auth/login" : "/api/auth/register", values);
    setBusy(false);
    if (!result.ok) {
      setError(errorText(result.error));
      return;
    }
    router.refresh();
  }

  const isLogin = mode === "login";
  return (
    <div className="max-w-sm">
      <div role="tablist" aria-label="Account" className="mb-6 flex gap-6 border-b border-earth-brown/15">
        {(["login", "register"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => { setMode(m); setError(undefined); }}
            className={`-mb-px border-b-2 pb-2 text-sm ${
              mode === m ? "border-terracotta text-charcoal" : "border-transparent text-earth-brown/70 hover:text-terracotta"
            }`}
          >
            {m === "login" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="grid gap-5" key={mode}>
        {!isLogin && (
          <Field label="Your name">
            <input name="name" required maxLength={100} autoComplete="name" className={fieldClass} />
          </Field>
        )}
        <Field label="Email">
          <input name="email" type="email" required autoComplete="email" className={fieldClass} />
        </Field>
        <Field label="Password" hint={isLogin ? undefined : "At least 8 characters."}>
          <input
            name="password"
            type="password"
            required
            minLength={isLogin ? undefined : 8}
            autoComplete={isLogin ? "current-password" : "new-password"}
            className={fieldClass}
          />
        </Field>
        {error && <FormMessage tone="error">{error}</FormMessage>}
        <div className="flex items-center gap-5">
          <Button type="submit" disabled={busy}>
            {busy ? "Please wait…" : isLogin ? "Sign in" : "Create account"}
          </Button>
          {isLogin && (
            <Link href="/account/forgot-password" className="text-sm text-terracotta hover:text-terracotta-deep">
              Forgot password?
            </Link>
          )}
        </div>
      </form>
    </div>
  );
}

export function ForgotPasswordForm() {
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [error, setError] = useState<string>();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("busy");
    setError(undefined);
    const result = await post("/api/auth/forgot-password", formValues(event));
    if (!result.ok) {
      setError(errorText(result.error));
      setState("idle");
      return;
    }
    setState("sent");
  }

  if (state === "sent") {
    return (
      <p role="status" className="max-w-sm text-sm leading-relaxed text-earth-brown/80">
        If an account exists for that email, we&apos;ve sent a link to reset your password. It
        expires in one hour.
      </p>
    );
  }
  return (
    <form onSubmit={onSubmit} className="grid max-w-sm gap-5">
      <Field label="Email">
        <input name="email" type="email" required autoComplete="email" className={fieldClass} />
      </Field>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <div>
        <Button type="submit" disabled={state === "busy"}>
          {state === "busy" ? "Sending…" : "Send reset link"}
        </Button>
      </div>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string>();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { password } = formValues(event);
    setState("busy");
    setError(undefined);
    const result = await post("/api/auth/reset-password", { token, password });
    if (!result.ok) {
      setError(errorText(result.error));
      setState("idle");
      return;
    }
    setState("done");
  }

  if (state === "done") {
    return (
      <div role="status" className="max-w-sm">
        <p className="text-sm text-earth-brown/80">Your password has been changed. Please sign in again.</p>
        <div className="mt-5"><Button href="/account">Sign in</Button></div>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="grid max-w-sm gap-5">
      <Field label="New password" hint="At least 8 characters.">
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className={fieldClass} />
      </Field>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <div>
        <Button type="submit" disabled={state === "busy"}>
          {state === "busy" ? "Saving…" : "Set new password"}
        </Button>
      </div>
    </form>
  );
}

/** Runs the verification on the user's click (not on page load), so email-security link scanners can't consume the token. */
export function VerifyEmailAction({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = useState<string>();

  async function confirm() {
    setState("busy");
    const result = await post("/api/auth/verify-email", { token });
    if (!result.ok) {
      setError(errorText(result.error));
      setState("error");
      return;
    }
    setState("done");
  }

  if (state === "done") {
    return (
      <div role="status">
        <p className="text-sm text-earth-brown/80">Your email is confirmed. Thank you!</p>
        <div className="mt-5"><Button href="/account">Go to your account</Button></div>
      </div>
    );
  }
  return (
    <div>
      {state === "error" && error && <FormMessage tone="error">{error}</FormMessage>}
      <div className="mt-4">
        <Button type="button" onClick={confirm} disabled={state === "busy"}>
          {state === "busy" ? "Confirming…" : "Confirm my email"}
        </Button>
      </div>
    </div>
  );
}

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await post("/api/auth/logout", {});
        router.refresh();
      }}
    >
      Sign out
    </Button>
  );
}
