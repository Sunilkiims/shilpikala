import { cn } from "@/lib/utils/cn";
import { siteConfig } from "@/lib/config/site";

/** ShilpiKala's own mark: a small mandala (concentric rings + eight petals) beside the wordmark. */
export function Logo({ className, showTagline = false, tone = "dark" }: { className?: string; showTagline?: boolean; tone?: "dark" | "light" }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 40 40" className={cn("h-9 w-9 shrink-0", tone === "light" ? "text-gold" : "text-terracotta")} fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <circle cx="20" cy="20" r="18" />
        <circle cx="20" cy="20" r="11" />
        {Array.from({ length: 8 }, (_, i) => {
          const a = (Math.PI / 4) * i;
          return <circle key={i} cx={20 + Math.cos(a) * 14.5} cy={20 + Math.sin(a) * 14.5} r="2.1" fill="currentColor" stroke="none" />;
        })}
        <circle cx="20" cy="20" r="3.2" fill="currentColor" stroke="none" />
      </svg>
      <span className="flex flex-col leading-none">
        <span className={cn("font-display text-2xl tracking-wide", tone === "light" ? "text-ivory" : "text-charcoal")}>{siteConfig.name}</span>
        {showTagline && <span className="mt-1 text-[10px] uppercase tracking-[0.22em] text-earth-brown/70">{siteConfig.tagline}</span>}
      </span>
    </span>
  );
}
