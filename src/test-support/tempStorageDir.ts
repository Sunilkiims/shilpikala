import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { vi } from "vitest";

/**
 * The store modules (catalogStore, orders/store, reviews/store) compute
 * their storage path as `path.join(process.cwd(), "storage", ...)` as a
 * top-level const, evaluated once at module import. To test them against
 * an isolated directory — never the real project's storage/ — each test
 * must: chdir into a fresh temp dir, reset the module cache, then
 * dynamically import the module under test so that top-level const
 * re-evaluates against the new cwd.
 *
 * Usage:
 *   let cleanup: () => void;
 *   beforeEach(() => { cleanup = isolateStorageDir(); });
 *   afterEach(() => cleanup());
 *   const store = await import("@/lib/store/catalogStore");
 */
export function isolateStorageDir(): () => void {
  const originalCwd = process.cwd();
  const dir = mkdtempSync(path.join(tmpdir(), "shilpikala-test-"));
  process.chdir(dir);
  vi.resetModules();

  // The database lives on globalThis (so it survives module resets);
  // wipe it so each test starts from a fresh, freshly-seeded database.
  (globalThis as { __shilpikalaDbWipe?: boolean }).__shilpikalaDbWipe = true;

  return () => {
    process.chdir(originalCwd);
    rmSync(dir, { recursive: true, force: true });
  };
}
