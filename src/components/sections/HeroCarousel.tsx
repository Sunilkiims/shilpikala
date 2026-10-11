"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { MandalaMotif } from "@/components/sections/MandalaMotif";

export type HeroSlide = {
  id: string;
  eyebrow: string;
  title: string;
  text: string;
  cta: { label: string; href: string };
  image?: { src: string; alt: string };
};

const AUTOPLAY_MS = 7000;

/** Promotional carousel: buttons, dots and swipe; autoplay pauses on hover, focus, hidden tab and for users who prefer reduced motion. */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const count = slides.length;

  const go = useCallback((i: number) => setIndex(((i % count) + count) % count), [count]);

  useEffect(() => {
    if (count < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setIndex((i) => (i + 1) % count);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [count, paused]);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured collections"
      className="relative overflow-hidden border-b border-earth-brown/15 bg-terracotta/[0.07]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 50) go(index + (dx < 0 ? 1 : -1));
      }}
    >
      <div className="flex transition-transform duration-500 ease-out motion-reduce:transition-none" style={{ transform: `translateX(-${index * 100}%)` }}>
        {slides.map((slide, i) => (
          <div
            key={slide.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            aria-hidden={i !== index}
            className="grid w-full shrink-0 grid-cols-1 md:grid-cols-2"
          >
            <div className="relative order-2 flex flex-col justify-center px-6 py-8 sm:px-10 md:order-1 md:py-14 lg:pl-[max(2rem,calc((100vw-80rem)/2+2rem))] lg:pr-12">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-terracotta-deep">{slide.eyebrow}</p>
              <h2 className="mt-3 max-w-lg text-3xl leading-[1.15] text-charcoal sm:text-4xl lg:text-5xl">{slide.title}</h2>
              <p className="mt-4 max-w-md text-base leading-relaxed text-earth-brown/85">{slide.text}</p>
              <div className="mt-6">
                <Link
                  href={slide.cta.href}
                  tabIndex={i === index ? 0 : -1}
                  className="inline-flex min-h-11 items-center rounded-sm bg-terracotta px-7 text-sm tracking-wide text-ivory transition-colors hover:bg-terracotta-deep"
                >
                  {slide.cta.label}
                </Link>
              </div>
            </div>

            <div className="relative order-1 aspect-[16/10] md:order-2 md:aspect-auto md:min-h-[26rem]">
              {slide.image ? (
                <Image
                  src={slide.image.src}
                  alt={slide.image.alt}
                  fill
                  priority={i === 0}
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-terracotta/10">
                  <MandalaMotif className="h-3/4 w-auto max-w-[80%] text-earth-brown" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Previous slide"
            className="absolute bottom-3 right-16 hidden h-11 w-11 items-center justify-center rounded-full bg-ivory/90 text-charcoal shadow transition-colors hover:text-terracotta md:bottom-4 md:flex"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Next slide"
            className="absolute bottom-3 right-3 hidden h-11 w-11 items-center justify-center rounded-full bg-ivory/90 text-charcoal shadow transition-colors hover:text-terracotta md:bottom-4 md:flex"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1 rounded-full bg-ivory/85 px-2 py-1 md:bottom-4">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => go(i)}
                aria-label={`Show slide ${i + 1}`}
                aria-current={i === index}
                className="flex h-6 w-6 items-center justify-center"
              >
                <span className={`block h-2 rounded-full transition-all ${i === index ? "w-6 bg-terracotta" : "w-2 bg-earth-brown/35"}`} />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
