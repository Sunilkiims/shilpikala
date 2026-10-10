import { Container } from "@/components/ui/Container";

type Section = { heading: string; body: React.ReactNode };

type ContentPageProps = {
  title: string;
  intro?: string;
  sections: Section[];
  /** Shown under the title, e.g. "Last updated …". */
  meta?: string;
  children?: React.ReactNode;
};

/** Shared layout for the text-led pages (about, shipping, returns, FAQ, legal). */
export function ContentPage({ title, intro, sections, meta, children }: ContentPageProps) {
  return (
    <Container className="py-12 sm:py-16">
      <div className="max-w-2xl">
        <h1 className="text-3xl text-charcoal sm:text-4xl">{title}</h1>
        {meta && <p className="mt-2 text-xs text-earth-brown/70">{meta}</p>}
        {intro && (
          <p className="mt-5 text-base leading-relaxed text-earth-brown/85">{intro}</p>
        )}
        <div className="mt-10 grid gap-9">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-xl text-charcoal">{section.heading}</h2>
              <div className="mt-3 grid gap-3 text-sm leading-relaxed text-earth-brown/85">
                {section.body}
              </div>
            </section>
          ))}
        </div>
        {children}
      </div>
    </Container>
  );
}
