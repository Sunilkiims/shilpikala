export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Appends -2, -3, etc. until the slug doesn't collide with an existing
 * one. Used by the admin create forms so two products named the same
 * thing don't silently overwrite each other.
 */
export function uniqueSlug(base: string, existingSlugs: string[]): string {
  const taken = new Set(existingSlugs);
  const baseSlug = slugify(base) || "item";
  if (!taken.has(baseSlug)) return baseSlug;

  let suffix = 2;
  while (taken.has(`${baseSlug}-${suffix}`)) suffix += 1;
  return `${baseSlug}-${suffix}`;
}
