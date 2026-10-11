"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, FormMessage, errorText, fieldClass } from "@/components/forms/fields";

type PostResult = { ok: boolean; status?: number; error?: string; data?: Record<string, unknown> };

async function post(url: string, body: unknown): Promise<PostResult> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (response.ok) return { ok: true, status: response.status, data };
    return { ok: false, status: response.status, error: typeof data.error === "string" ? data.error : undefined, data };
  } catch {
    return { ok: false };
  }
}

function formValues(event: React.FormEvent<HTMLFormElement>): Record<string, string> {
  return Object.fromEntries(
    Array.from(new FormData(event.currentTarget).entries()).map(([k, v]) => [k, String(v)])
  );
}

type Pending = { email: string; expiresAt: number; resendAt: number };

const pendingFrom = (data: Record<string, unknown> | undefined, email: string): Pending => ({
  email,
  expiresAt: Date.now() + (Number(data?.expiresInSeconds) || 300) * 1000,
  resendAt: Date.now() + (Number(data?.resendInSeconds) || 60) * 1000,
});

/** Sign in / create account, switchable in place. Sign-up ends with an emailed six-digit code. */
export function SignInRegister({ initialMode = "login" }: { initialMode?: "login" | "register" } = {}) {
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState<Pending>();
  // Kept so "Change email" brings the person back to what they typed.
  const [draft, setDraft] = useState<{ name: string; email: string }>({ name: "", email: "" });
  const router = useRouter();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = formValues(event);
    setBusy(true);
    setError(undefined);
    setDraft({ name: values.name ?? "", email: values.email ?? "" });
    const result = await post(mode === "login" ? "/api/auth/login" : "/api/auth/register", values);
    setBusy(false);
    if (result.ok && mode === "register") {
      setPending(pendingFrom(result.data, String(result.data?.email ?? values.email)));
      return;
    }
    if (!result.ok && result.error === "email_not_verified") {
      // An older account that never confirmed its email: a code is on its way.
      setPending(pendingFrom(result.data, String(result.data?.email ?? values.email)));
      return;
    }
    if (!result.ok) {
      setError(errorText(result.error));
      return;
    }
    router.refresh();
  }

  if (pending) {
    return (
      <OtpStep
        pending={pending}
        onChange={setPending}
        onBack={() => {
          setPending(undefined);
          setMode("register");
          setError(undefined);
        }}
        onDone={() => router.refresh()}
      />
    );
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
            <input name="name" required maxLength={100} autoComplete="name" defaultValue={draft.name} className={fieldClass} />
          </Field>
        )}
        <Field label="Email">
          <input name="email" type="email" required autoComplete="email" defaultValue={draft.email} className={fieldClass} />
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
        {!isLogin && (
          <p className="text-xs leading-relaxed text-earth-brown/70">
            We&apos;ll email you a 6-digit code to confirm this address before your account is created.
          </p>
        )}
      </form>
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Enter the emailed code. Shows the expiry countdown and a 60-second resend cooldown. */
function OtpStep({
  pending, onChange, onBack, onDone,
}: {
  pending: Pending;
  onChange: (p: Pending) => void;
  onBack: () => void;
  onDone: () => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [now, setNow] = useState(() => Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => inputRef.current?.focus(), []);

  const left = Math.max(0, Math.ceil((pending.expiresAt - now) / 1000));
  const resendIn = Math.max(0, Math.ceil((pending.resendAt - now) / 1000));
  const expired = left === 0;

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (code.length !== 6) {
      setError("Enter the 6-digit code from your email.");
      inputRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    const result = await post("/api/auth/register/verify", { email: pending.email, code });
    setBusy(false);
    if (result.ok) {
      onDone();
      return;
    }
    setError(errorText(result.error));
    if (result.error === "invalid_code") setCode("");
    inputRef.current?.focus();
  }

  async function resend() {
    setResending(true);
    setError(undefined);
    setNotice(undefined);
    const result = await post("/api/auth/register/resend", { email: pending.email });
    setResending(false);
    if (result.ok) {
      onChange(pendingFrom(result.data, pending.email));
      setCode("");
      setNotice("A new code is on its way. The previous one no longer works.");
      inputRef.current?.focus();
      return;
    }
    const wait = Number(result.data?.retryAfterSeconds);
    if (result.error === "cooldown" && wait > 0) onChange({ ...pending, resendAt: Date.now() + wait * 1000 });
    setError(errorText(result.error));
  }

  return (
    <div className="max-w-sm">
      <h2 className="text-2xl text-charcoal">Check your email</h2>
      <p className="mt-2 text-sm leading-relaxed text-earth-brown/80">
        We sent a 6-digit code to <strong className="font-medium text-charcoal [overflow-wrap:anywhere]">{pending.email}</strong>.
        Enter it below to verify your address.
      </p>

      <form onSubmit={verify} className="mt-6 grid gap-4" noValidate>
        <div>
          <label htmlFor="otp-code" className="text-sm text-earth-brown/80">Verification code</label>
          <input
            id="otp-code"
            ref={inputRef}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            aria-describedby="otp-hint"
            aria-invalid={Boolean(error)}
            placeholder="······"
            className="mt-1.5 w-full border border-earth-brown/25 bg-transparent px-3 py-3 text-center font-mono text-2xl tracking-[0.5em] text-charcoal outline-none placeholder:text-earth-brown/30 focus-visible:border-terracotta"
          />
          <p id="otp-hint" className="mt-1.5 text-xs text-earth-brown/70">
            {expired ? (
              <span className="text-terracotta-deep">This code has expired. Request a new one below.</span>
            ) : (
              <>Code expires in <span className="font-medium text-charcoal">{pad(Math.floor(left / 60))}:{pad(left % 60)}</span></>
            )}
          </p>
        </div>

        <div aria-live="polite">
          {error && <FormMessage tone="error">{error}</FormMessage>}
          {notice && !error && <FormMessage tone="success">{notice}</FormMessage>}
        </div>

        <Button type="submit" disabled={busy || expired || code.length !== 6} className="w-full">
          {busy ? "Verifying…" : "Verify email"}
        </Button>
      </form>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
        <button
          type="button"
          onClick={resend}
          disabled={resendIn > 0 || resending}
          className="text-terracotta hover:text-terracotta-deep disabled:cursor-not-allowed disabled:text-earth-brown/50"
        >
          {resending ? "Sending…" : resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
        </button>
        <button type="button" onClick={onBack} className="text-earth-brown/80 underline underline-offset-2 hover:text-terracotta">
          Wrong email? Change it
        </button>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-earth-brown/70">
        Can&apos;t see it? Check your spam folder. Never share this code with anyone.
      </p>
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
