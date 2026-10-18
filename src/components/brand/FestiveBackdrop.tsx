import { siteConfig } from "@/lib/config/site";

/** Warm fairy-light colours: gold, amber, soft terracotta, cream. */
const BULBS = ["#e8b84a", "#f0a63c", "#d98a5f", "#f6dca0"];

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
 * Festive decoration drawn BEHIND the content it is placed in: a thin string of softly twinkling fairy lights
 * along the top edge and a few gold sparkles, over a warm marigold glow. Pure CSS/SVG,
 * ignores taps, hidden from screen readers, and frozen automatically for people who prefer reduced
 * motion. Switch it off with `festive: false` in src/lib/config/site.ts.
 *
 * The parent must be `relative`/`sticky` and create its own stacking context (e.g. have a z-index).
 */
export function FestiveBackdrop({
  lights = true,
  phoneOnly = false,
}: {
  lights?: boolean;
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

      {lights && (
        <div className="absolute inset-x-0 top-[env(safe-area-inset-top)]">
          {/* A thin wire with small glowing bulbs hanging at alternating heights. */}
          <div className="h-px w-full bg-earth-brown/20" />
          <div className="flex justify-between px-2">
            {Array.from({ length: 16 }, (_, i) => {
              const color = BULBS[i % BULBS.length];
              return (
                <span
                  key={i}
                  className="sk-bulb block h-1.5 w-1.5 rounded-full"
                  style={{
                    backgroundColor: color,
                    boxShadow: `0 0 6px 2px ${color}99`,
                    marginTop: i % 2 === 0 ? 2 : 6,
                    animationDelay: `${(i % 7) * 0.4}s`,
                  }}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
