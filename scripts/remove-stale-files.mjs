// Removes files left behind by an abandoned storefront redesign.
// Extracting a newer zip over an older project folder never deletes old
// files, and the leftovers break the build (e.g. catalogQuery.ts importing
// an export that no longer exists). None of these paths are used by the
// current code, so deleting them is always safe. Runs before build/dev/test.
import { existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const STALE = [
  "src/app/api/search",
  "src/components/cart/OrderSummary.tsx",
  "src/components/cart/QuickAdd.tsx",
  "src/components/header/AccountLink.tsx",
  "src/components/header/CategoryBar.tsx",
  "src/components/header/MobileDrawer.tsx",
  "src/components/header/SearchBox.tsx",
  "src/components/product/RecentlyViewed.tsx",
  "src/components/sections/HeroCarousel.tsx",
  "src/components/sections/HomeSections.tsx",
  "src/components/shop",
  "src/components/ui/Logo.tsx",
  "src/components/ui/Shelf.tsx",
  "src/lib/shop",
  "src/lib/store/catalogQuery.ts",
  "src/lib/store/catalogQuery.test.ts",
];

let removed = 0;
for (const rel of STALE) {
  const p = join(root, rel);
  if (existsSync(p)) {
    rmSync(p, { recursive: true, force: true });
    console.log(`removed stale file: ${rel}`);
    removed++;
  }
}
if (removed) console.log(`Cleaned ${removed} leftover redesign file(s). Remove .next if problems persist.`);
