import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { ContentPage } from "@/components/ui/ContentPage";
import { Hero } from "@/components/sections/Hero";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = buildMetadata({
  title: "About",
  description:
    "ShilpiKala celebrates Mandala Art, Lipan Art and handmade Indian artistry — made slowly, by hand.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <>
      <Hero headingAs="h2" />
      <ContentPage
        title="Art made slowly, by hand."
        intro="ShilpiKala is a small studio for Mandala Art, Lipan Art and handmade decorative pieces — traditional Indian craft with a contemporary eye."
        sections={[
          {
            heading: "Mandala Art",
            body: [
              <p key="1">
                Every mandala begins at the centre and grows outward in rings,
                each petal drawn and repeated by hand. The patterns are fine,
                symmetrical and unhurried — the kind of work that rewards a long
                look.
              </p>,
            ],
          },
          {
            heading: "Lipan Art",
            body: [
              <p key="1">
                Lipan is a clay-relief tradition from Kutch, worked in earthy
                terracotta with small mirror accents. We keep its warmth and
                texture, and bring it to pieces made for today&apos;s homes.
              </p>,
            ],
          },
          {
            heading: "Made to order, made to last",
            body: [
              <p key="1">
                Each piece is made by hand, so no two are exactly alike. If you
                have something specific in mind — a size, a palette, a gift — we
                take commissions too.
              </p>,
            ],
          },
        ]}
      >
        <div className="mt-12 flex flex-wrap gap-4">
          <Button href="/shop">Explore the shop</Button>
          <Button href="/custom-art" variant="secondary">
            Commission a piece
          </Button>
        </div>
      </ContentPage>
    </>
  );
}
