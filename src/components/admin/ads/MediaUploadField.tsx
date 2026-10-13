"use client";

import { useRef, useState } from "react";
import { adError } from "@/components/admin/ads/types";
import type { MediaInfo } from "@/lib/ads/types";

const MAX = 4 * 1024 * 1024;

type Props = { label: string; hint: string; value?: MediaInfo; onChange: (m: MediaInfo | undefined) => void };

export function MediaUploadField({ label, hint, value, onChange }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(undefined);
    if (file.size > MAX) { setError(adError("file_too_large")); e.target.value = ""; return; }
    setBusy(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/admin/ads/media", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as { media?: MediaInfo; error?: string };
      if (!res.ok || !data.media) setError(adError(data.error));
      else onChange(data.media);
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div className="border border-earth-brown/20 p-3">
      <p className="text-sm text-charcoal">{label}</p>
      <p className="mt-0.5 text-xs text-earth-brown/70">{hint}</p>
      {value ? (
        <div className="mt-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value.src} width={value.width} height={value.height} alt="" className="max-h-40 w-auto max-w-full border border-earth-brown/15 bg-earth-brown/5" />
          <p className="mt-1 text-xs text-earth-brown/75">
            {value.width}×{value.height}px · {(value.size / 1024).toFixed(0)} KB · {value.mime.replace("image/", "").toUpperCase()}
            {value.animated && <span className="ml-2 rounded-full bg-gold/30 px-2 py-0.5 text-earth-brown">Animated</span>}
          </p>
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" disabled={busy} onClick={() => input.current?.click()} className="rounded-sm border border-earth-brown/30 px-4 py-2 text-sm hover:border-terracotta hover:text-terracotta disabled:opacity-50">
          {busy ? "Uploading…" : value ? "Replace" : "Upload image or GIF"}
        </button>
        {value && !busy && (
          <button type="button" onClick={() => onChange(undefined)} className="text-sm text-earth-brown/75 underline underline-offset-2 hover:text-terracotta">Remove</button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={pick} className="sr-only" aria-label={`${label} file`} tabIndex={-1} />
      {error && <p role="alert" className="mt-2 text-sm text-terracotta-deep">{error}</p>}
    </div>
  );
}
