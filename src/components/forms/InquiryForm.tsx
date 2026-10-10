"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, FormMessage, errorText, fieldClass } from "@/components/forms/fields";

type Props = {
  kind: "contact" | "custom-art";
};

export function InquiryForm({ kind }: Props) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string>();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setState("sending");
    setError(undefined);
    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, kind }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(errorText(body.error));
        setState("error");
        return;
      }
      form.reset();
      setState("sent");
    } catch {
      setError(errorText(undefined));
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <div role="status" className="max-w-lg border border-olive/30 bg-olive/5 p-6">
        <p className="font-display text-xl text-charcoal">Thank you — we&apos;ve received it.</p>
        <p className="mt-2 text-sm leading-relaxed text-earth-brown/80">
          {kind === "custom-art"
            ? "We'll review your idea and reply by email with questions, a quote and a timeline."
            : "We'll reply to your email as soon as we can."}
        </p>
        <button
          type="button"
          onClick={() => setState("idle")}
          className="mt-4 text-sm text-terracotta hover:text-terracotta-deep"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-lg gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name">
          <input name="name" required maxLength={100} autoComplete="name" className={fieldClass} />
        </Field>
        <Field label="Email">
          <input name="email" type="email" required maxLength={254} autoComplete="email" className={fieldClass} />
        </Field>
      </div>
      <Field label="Phone (optional)">
        <input name="phone" type="tel" maxLength={30} autoComplete="tel" className={fieldClass} />
      </Field>

      {kind === "contact" ? (
        <Field label="Subject (optional)">
          <input name="subject" maxLength={150} className={fieldClass} />
        </Field>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Style">
              <select name="style" defaultValue="" className={fieldClass}>
                <option value="">Not sure yet</option>
                <option>Mandala</option>
                <option>Lipan</option>
                <option>Mixed</option>
              </select>
            </Field>
            <Field label="Approximate size">
              <input name="size" maxLength={80} placeholder="e.g. 24 × 24 in" className={fieldClass} />
            </Field>
            <Field label="Budget (optional)">
              <input name="budget" maxLength={80} placeholder="e.g. ₹10,000" className={fieldClass} />
            </Field>
            <Field label="Needed by (optional)">
              <input name="deadline" maxLength={80} placeholder="e.g. end of November" className={fieldClass} />
            </Field>
          </div>
        </>
      )}

      <Field
        label={kind === "custom-art" ? "Tell us about your idea" : "Message"}
        hint={kind === "custom-art" ? "Occasion, colours, where it will hang, anything you've seen and liked." : undefined}
      >
        <textarea name="message" required minLength={10} maxLength={4000} rows={6} className={fieldClass} />
      </Field>

      {/* Honeypot: hidden from people and assistive tech; bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {state === "error" && error && <FormMessage tone="error">{error}</FormMessage>}
      <div>
        <Button type="submit" disabled={state === "sending"}>
          {state === "sending" ? "Sending…" : kind === "custom-art" ? "Request a quote" : "Send message"}
        </Button>
      </div>
    </form>
  );
}
