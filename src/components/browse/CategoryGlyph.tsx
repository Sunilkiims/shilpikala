type Props = { slug: string; name?: string; className?: string };

type Kind = "mandala" | "lipan" | "hand" | "frame" | "gift" | "brush";

function kindFor(slug: string, name = ""): Kind {
  const s = `${slug} ${name}`.toLowerCase();
  if (s.includes("mandala")) return "mandala";
  if (s.includes("lipan")) return "lipan";
  if (s.includes("hand")) return "hand";
  if (s.includes("wall") || s.includes("frame") || s.includes("paint")) return "frame";
  if (s.includes("custom")) return "brush";
  if (s.includes("gift") || s.includes("decor")) return "gift";
  return "mandala";
}

/** Simple one-colour line icons for the round category shortcuts. They inherit the text colour. */
export function CategoryGlyph({ slug, name, className }: Props) {
  const kind = kindFor(slug, name);
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {kind === "mandala" && (
        <>
          <circle cx="24" cy="24" r="4" />
          {Array.from({ length: 8 }, (_, i) => (
            <ellipse key={i} cx="24" cy="10.5" rx="3.6" ry="7" transform={`rotate(${i * 45} 24 24)`} />
          ))}
        </>
      )}
      {kind === "lipan" && (
        <>
          <circle cx="24" cy="24" r="3.6" />
          {[0, 90, 180, 270].map((a) => (
            <ellipse key={a} cx="24" cy="11.5" rx="4.4" ry="7.5" transform={`rotate(${a} 24 24)`} />
          ))}
          {[45, 135, 225, 315].map((a) => (
            <circle key={a} cx="24" cy="6.5" r="1.6" transform={`rotate(${a} 24 24)`} />
          ))}
        </>
      )}
      {kind === "hand" && (
        <>
          <path d="M16 25V13.5a2.3 2.3 0 0 1 4.6 0V22" />
          <path d="M20.6 21V9.5a2.3 2.3 0 0 1 4.6 0V21" />
          <path d="M25.2 21V11.5a2.3 2.3 0 0 1 4.6 0V25" />
          <path d="M29.8 22.5v-5a2.3 2.3 0 0 1 4.6 0V30c0 6.6-4.6 11-10.6 11-4 0-6.6-1.7-8.6-4.4L9.6 29a2.4 2.4 0 0 1 3.6-3.1L16 29" />
        </>
      )}
      {kind === "frame" && (
        <>
          <rect x="8" y="11" width="32" height="28" rx="2" />
          <path d="M24 5l-7 6h14z" />
          <circle cx="17" cy="22" r="2" />
          <path d="M9 37l10-9 6 5 5-4 9 8" />
        </>
      )}
      {kind === "gift" && (
        <>
          <rect x="8" y="19" width="32" height="8" rx="1.5" />
          <path d="M10 27v13h28V27" />
          <path d="M24 19v21" />
          <path d="M24 19c-6 0-9-2-9-5s3-4.5 5.5-3S24 16 24 19zM24 19c6 0 9-2 9-5s-3-4.5-5.5-3S24 16 24 19z" />
        </>
      )}
      {kind === "brush" && (
        <>
          <path d="M36 8l4 4-18 18-6 1.5L17.5 26z" />
          <path d="M16 31c-3 0-6 2-6 6 0 2 1 3 3 3 5 0 7-3 7-6" />
        </>
      )}
    </svg>
  );
}
