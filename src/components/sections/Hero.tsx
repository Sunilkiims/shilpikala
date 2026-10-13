import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { MandalaMotif } from "@/components/sections/MandalaMotif";
import { siteConfig } from "@/lib/config/site";

export function Hero({ headingAs: Heading = "h1" }: { headingAs?: "h1" | "h2" }) {
  return (
    <section className="overflow-hidden">
      <Container className="grid items-center gap-12 py-16 sm:py-24 md:grid-cols-12 md:gap-8">
        <div className="md:col-span-7">
          <p className="font-display text-lg text-terracotta">
            {siteConfig.name}
          </p>
          <p className="mt-2 text-sm tracking-wide text-earth-brown/70">
            {siteConfig.tagline}
          </p>

          <Heading className="mt-6 max-w-xl text-4xl leading-[1.15] text-charcoal sm:text-5xl">
            Where tradition meets contemporary artistry.
          </Heading>

          <p className="mt-6 max-w-md text-base leading-relaxed text-earth-brown/80">
            {siteConfig.description}
          </p>

          <div className="mt-9">
            <Button href="/shop">Explore Our Art</Button>
          </div>
        </div>

        <div className="md:col-span-5">
          <MandalaMotif className="mx-auto h-auto w-full max-w-sm text-earth-brown" />
        </div>
      </Container>
    </section>
  );
}
