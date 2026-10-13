"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdSettingsForm({ autoplay, seconds }: { autoplay: boolean; seconds: number }) {
  const router = useRouter();
  const [on, setOn] = useState(autoplay);
  const [secs, setSecs] = useState(String(seconds));
  const [state, setState] = useState<"idle" | "busy" | "saved" | "error">("idle");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    const res = await fetch("/api/admin/ads/settings", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ heroAutoplay: on, heroIntervalSeconds: Number(secs) }),
    }).catch(() => null);
    setState(res?.ok ? "saved" : "error");
    if (res?.ok) router.refresh();
  }

  return (
    <form onSubmit={save} className="flex flex-wrap items-end gap-x-6 gap-y-3 text-sm">
      <label className="flex min-h-10 items-center gap-2">
        <input type="checkbox" checked={on} onChange={(e) => { setOn(e.target.checked); setState("idle"); }} className="h-4 w-4 accent-terracotta" />
        Hero banners slide automatically
      </label>
      <label className="flex items-center gap-2">
        Every
        <input type="number" min={3} max={30} value={secs} onChange={(e) => { setSecs(e.target.value); setState("idle"); }} disabled={!on} aria-label="Seconds between slides"
          className="w-16 border border-earth-brown/25 bg-transparent px-2 py-1.5 disabled:opacity-50" />
        seconds
      </label>
      <button type="submit" disabled={state === "busy"} className="min-h-10 rounded-sm border border-earth-brown/30 px-4 hover:border-terracotta hover:text-terracotta disabled:opacity-60">Save</button>
      {state === "saved" && <span role="status" className="text-olive">Saved.</span>}
      {state === "error" && <span role="alert" className="text-terracotta-deep">Couldn&apos;t save (3–30 seconds).</span>}
    </form>
  );
}
