import {
  createPgDriver,
  createPgliteDriver,
  resolvePgliteDataDir,
  type Db,
} from "@/lib/db/client";
import { migrations } from "@/lib/db/migrations";
import { seedCatalogueOnce } from "@/lib/db/seed";

type State = { key: string; kind: "postgres" | "pglite"; ready: Promise<Db> };

const g = globalThis as unknown as {
  __shilpikalaDb?: State;
  /** Set by test helpers: wipe + re-migrate the existing instance on next use. */
  __shilpikalaDbWipe?: boolean;
};

function currentKey(): string {
  return process.env.DATABASE_URL ?? `pglite:${process.env.NODE_ENV}`;
}

async function migrate(db: Db): Promise<void> {
  await db.transaction(async (tx) => {
    // Serialises concurrent boots (multiple serverless instances).
    await tx.query("SELECT pg_advisory_xact_lock(727274)");
    await tx.exec(
      "CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())"
    );
    const done = await tx.query<{ id: string }>("SELECT id FROM schema_migrations");
    const applied = new Set(done.rows.map((r) => r.id));
    for (const migration of migrations) {
      if (applied.has(migration.id)) continue;
      await tx.exec(migration.sql);
      await tx.query("INSERT INTO schema_migrations (id) VALUES ($1)", [migration.id]);
    }
    await seedCatalogueOnce(tx);
  });
}

/**
 * A paused serverless database (Neon etc.) can drop the very first
 * connection while it wakes up. Retry transient connection failures a
 * few times before giving up.
 */
async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (error) {
      const message = (error as Error).message ?? "";
      const transient =
        /Connection terminated|ECONNRESET|ECONNREFUSED|ETIMEDOUT|timeout|the database system is starting up/i.test(message);
      if (!transient || i >= attempts) throw error;
      await new Promise((r) => setTimeout(r, 500 * 2 ** (i - 1)));
    }
  }
}

async function boot(): Promise<{ kind: State["kind"]; db: Db }> {
  const url = process.env.DATABASE_URL;
  // In production the data must live in PostgreSQL. The embedded database
  // is a local-development convenience and would silently keep customer
  // data in a folder on one server (or lose it on serverless hosts).
  if (
    !url &&
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PHASE !== "phase-production-build" &&
    process.env.ALLOW_EMBEDDED_DB !== "true"
  ) {
    throw new Error(
      "DATABASE_URL is not set. Set it to your PostgreSQL connection string " +
        "(or set ALLOW_EMBEDDED_DB=true to knowingly use the local embedded database)."
    );
  }
  const db = url
    ? await createPgDriver(url)
    : await createPgliteDriver(resolvePgliteDataDir());
  await withRetry(() => migrate(db));
  return { kind: url ? "postgres" : "pglite", db };
}

function ensure(): State {
  const key = currentKey();
  const wipe = g.__shilpikalaDbWipe === true;
  g.__shilpikalaDbWipe = false;

  if (!g.__shilpikalaDb || g.__shilpikalaDb.key !== key) {
    const pending = boot();
    const state: State = {
      key,
      kind: process.env.DATABASE_URL ? "postgres" : "pglite",
      ready: pending.then((r) => r.db),
    };
    // A failed boot must not poison every later call.
    pending.catch(() => {
      if (g.__shilpikalaDb === state) g.__shilpikalaDb = undefined;
    });
    g.__shilpikalaDb = state;
  }

  const state = g.__shilpikalaDb;
  if (wipe) {
    // Test isolation. Applies to a freshly-booted instance too: a real
    // PostgreSQL database may still hold data from a previous test process.
    state.ready = state.ready.then(async (db) => {
      await db.exec("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
      await migrate(db);
      return db;
    });
  }
  return state;
}

export function getDb(): Promise<Db> {
  return ensure().ready;
}

export function getDbKind(): "postgres" | "pglite" {
  return ensure().kind;
}

/** Test helper: the next getDb() starts from an empty, re-migrated, re-seeded database. */
export function markDatabaseForWipe(): void {
  g.__shilpikalaDbWipe = true;
}
