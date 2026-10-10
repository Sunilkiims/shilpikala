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

async function boot(): Promise<{ kind: State["kind"]; db: Db }> {
  const url = process.env.DATABASE_URL;
  const db = url
    ? await createPgDriver(url)
    : await createPgliteDriver(resolvePgliteDataDir());
  await migrate(db);
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
