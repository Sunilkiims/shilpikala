/**
 * The ShilpiKala mandala mark, drawn exactly like the one printed on invoices
 * (outer ring, inner ring, eight petals dots and a centre dot) in the brand terracotta.
 */
export function BrandMark({ className }: { className?: string }) {
  const r = 20;
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true" focusable="false" fill="currentColor">
      <circle cx="20" cy="20" r={r - 0.5} fill="none" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="20" cy="20" r={r * 0.62} fill="none" stroke="currentColor" strokeWidth="1.2" />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (Math.PI / 4) * i;
        return (
          <circle
            key={i}
            cx={(20 + Math.cos(a) * r * 0.81).toFixed(2)}
            cy={(20 + Math.sin(a) * r * 0.81).toFixed(2)}
            r={r * 0.14}
          />
        );
      })}
      <circle cx="20" cy="20" r={r * 0.2} />
    </svg>
  );
}
