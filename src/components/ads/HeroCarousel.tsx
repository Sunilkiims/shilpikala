"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BannerSlide } from "@/components/ads/BannerSlide";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { Container } from "@/components/ui/Container";
import type { RenderableAd } from "@/lib/ads/public";

const REDUCED = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

type Props = { slides: RenderableAd[]; autoplay: boolean; intervalSeconds: number };

/**
 * Swipeable banner carousel (native scroll-snap, so touch swiping is the browser's own),
 * with arrows, dots and optional autoplay. Autoplay stops on hover, focus, touch, when the
 * tab is hidden and for people who prefer reduced motion, and has a visible pause button.
 */
export function HeroCarousel({ slides, autoplay, intervalSeconds }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, () => window.matchMedia(REDUCED).matches, () => false);
  const count = slides.length;

  const goTo = useCallback((i: number) => {
    const el = scroller.current;
    if (!el) return;
    const target = ((i % count) + count) % count;
    el.scrollTo({ left: target * el.clientWidth, behavior: reducedMotion ? "auto" : "smooth" });
  }, [count, reducedMotion]);

  const onScroll = () => {
    const el = scroller.current;
    if (el && el.clientWidth) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  useEffect(() => {
    if (!autoplay || count < 2 || paused || userPaused || reducedMotion) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      goTo(index + 1);
    }, intervalSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [autoplay, count, paused, userPaused, reducedMotion, intervalSeconds, index, goTo]);

  const autoplaying = autoplay && count > 1 && !reducedMotion;

  return (
    <section aria-roledescription="carousel" aria-label="Featured promotions" className="pt-4 sm:pt-6">
      <Container>
        <div
          className="group relative"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          onTouchStart={() => setPaused(true)}
          onTouchEnd={() => setPaused(false)}
        >
          <div
            ref={scroller}
            onScroll={onScroll}
            className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-live={autoplaying && !paused && !userPaused ? "off" : "polite"}
          >
            {slides.map((slide, i) => (
              <div
                key={slide.id}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${count}`}
                className="flex w-full shrink-0 snap-center items-center"
                // Slides off screen are skipped by keyboard users; they can use the arrows or dots.
                {...(i !== index ? { inert: true } : {})}
              >
                <BannerSlide ad={slide} eager={i === 0} className="w-full" />
              </div>
            ))}
          </div>

          {count > 1 && (
            <>
              <button
                type="button"
                onClick={() => goTo(index - 1)}
                aria-label="Previous slide"
                className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-ivory/90 text-charcoal shadow transition-opacity hover:bg-ivory md:flex md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => goTo(index + 1)}
                aria-label="Next slide"
                className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-ivory/90 text-charcoal shadow transition-opacity hover:bg-ivory md:flex md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </>
          )}
        </div>

        {count > 1 && (
          <div className="mt-3 flex items-center justify-center gap-2">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index ? "true" : undefined}
                // 24px hit area around a small dot
                className="flex h-6 w-6 items-center justify-center"
              >
                <span className={`block h-2 rounded-full transition-all ${i === index ? "w-6 bg-terracotta" : "w-2 bg-earth-brown/30"}`} />
              </button>
            ))}
            {autoplaying && (
              <button
                type="button"
                onClick={() => setUserPaused((v) => !v)}
                aria-label={userPaused ? "Resume automatic slide show" : "Pause automatic slide show"}
                className="ml-2 flex h-6 items-center rounded-full border border-earth-brown/25 px-2 text-[11px] text-earth-brown/80 hover:text-terracotta"
              >
                {userPaused ? "Play" : "Pause"}
              </button>
            )}
          </div>
        )}
      </Container>
    </section>
  );
}
