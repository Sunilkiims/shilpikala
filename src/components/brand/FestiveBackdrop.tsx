import { siteConfig } from "@/lib/config/site";

const PENNANTS = ["#e0a526", "#a65335", "#4e5638", "#c8372d"];

/** [left %, top %, size px, delay s, duration s] */
const SPARKLES: [number, number, number, number, number][] = [
  [6, 38, 10, 0, 2.6],
  [17, 70, 8, 0.9, 3.1],
  [29, 30, 12, 1.7, 2.4],
  [41, 74, 9, 0.4, 3.4],
  [53, 28, 8, 2.2, 2.8],
  [64, 68, 11, 1.2, 2.5],
  [76, 36, 9, 2.8, 3.2],
  [88, 72, 12, 0.6, 2.7],
  [95, 32, 8, 1.9, 3.0],
];

/**
 * Festive decoration drawn BEHIND the content it is placed in: a swaying toran (string of pennants)
 * along the top edge and softly twinkling gold sparkles, over a warm marigold glow. Pure CSS/SVG,
 * ignores taps, hidden from screen readers, and frozen automatically for people who prefer reduced
 * motion. Switch it off with `festive: false` in src/lib/config/site.ts.
 *
 * The parent must be `relative`/`sticky` and create its own stacking context (e.g. have a z-index).
 */
export function FestiveBackdrop({
  toran = true,
  phoneOnly = false,
}: {
  toran?: boolean;
  phoneOnly?: boolean;
}) {
  if (!siteConfig.festive) return null;
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden${phoneOnly ? " md:hidden" : ""}`}
    >
      <div className="sk-glow absolute -left-10 top-0 h-24 w-40 rounded-full bg-[#e0a526]/25 blur-2xl" />
      <div className="sk-glow absolute -right-10 bottom-0 h-24 w-40 rounded-full bg-terracotta/15 blur-2xl [animation-delay:1.8s]" />

      {SPARKLES.map(([left, top, size, delay, dur], i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          className="sk-twinkle absolute text-[#d9a021]"
          style={{
            left: `${left}%`,
            top: `${top}%`,
            width: size,
            height: size,
            animationDelay: `${delay}s`,
            animationDuration: `${dur}s`,
          }}
          fill="currentColor"
        >
          <path d="M12 0c.9 6.3 5.7 11.1 12 12-6.3.9-11.1 5.7-12 12-.9-6.3-5.7-11.1-12-12C6.3 11.1 11.1 6.3 12 0z" />
        </svg>
      ))}

      {toran && (
        <div className="absolute inset-x-0 top-[env(safe-area-inset-top)]">
          <div className="h-px w-full bg-terracotta/40" />
          <div className="flex justify-between px-1">
            {Array.from({ length: 18 }, (_, i) => (
              <svg
                key={i}
                viewBox="0 0 20 24"
                className="sk-sway h-3.5 w-3 shrink-0 origin-top sm:h-4 sm:w-3.5"
                style={{ animationDelay: `${(i % 6) * 0.35}s` }}
              >
                <path d="M0 0h20L10 24z" fill={PENNANTS[i % PENNANTS.length]} />
                <circle cx="10" cy="7" r="2" fill="#f7f2e8" fillOpacity=".75" />
              </svg>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
