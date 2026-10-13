export type Crumb = {
  label: string;
  href?: string;
};

type BreadcrumbsProps = {
  items: Crumb[];
};

/**
 * The visible "Home / Shop / ..." trail is switched off site-wide. Pages still
 * pass their trail in because the BreadcrumbList structured data (SEO) is
 * generated separately from the same items; only the on-page markup is gone.
 */
export function Breadcrumbs(props: BreadcrumbsProps) {
  void props;
  return null;
}
