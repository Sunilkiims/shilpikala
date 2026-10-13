import Link from "next/link";

type Props = { href?: string; external?: boolean; className?: string; label?: string; children: React.ReactNode };

/** The whole banner is one link when a destination is set (so CTA text is part of it, never a nested link). */
export function AdLink({ href, external, className, label, children }: Props) {
  if (!href) return <div className={className}>{children}</div>;
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer nofollow" className={className} aria-label={label}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} aria-label={label}>
      {children}
    </Link>
  );
}
