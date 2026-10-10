import path from "node:path";

/**
 * A deliberately tiny database interface so the rest of the app doesn't
 * care whether it's talking to a real PostgreSQL server (production —
 * `DATABASE_URL`) or the embedded PGlite engine (local dev, tests and
 * `next build`, where no server is needed). Both speak the same SQL.
 */
export type QueryResult<T> = { rows: T[]; rowCount: number };

export type Db = {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ): Promise<QueryResult<T>>;
  /** Multi-statement SQL with no parameters (migrations). */
  exec(sql: string): Promise<void>;
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
};

export type PgConnectionSettings = {
  connectionString: string;
  ssl: boolean | { rejectUnauthorized: boolean };
};

/**
 * Turns DATABASE_URL (+ DATABASE_SSL) into explicit pg settings.
 *
 * `sslmode=` is removed from the URL and replaced by an explicit `ssl`
 * option: newer versions of `pg` print a security warning for
 * `sslmode=require` and let the URL override our setting.
 *   - SSL is on if DATABASE_SSL is "true"/"require"/"no-verify" or the URL asks for it.
 *   - The server certificate is verified unless DATABASE_SSL=no-verify
 *     (only for providers with self-signed certificates).
 */
export function buildPgSettings(
  url: string,
  sslEnv: string | undefined = process.env.DATABASE_SSL
): PgConnectionSettings {
  let sslFromUrl = false;
  let connectionString = url;
  try {
    const parsed = new URL(url);
    const mode = parsed.searchParams.get("sslmode");
    if (mode !== null) {
      sslFromUrl = mode !== "disable" && mode !== "allow";
      parsed.searchParams.delete("sslmode");
      connectionString = parsed.toString();
    }
  } catch {
    /* not a parseable URL — let pg report it */
  }
  const flag = (sslEnv ?? "").toLowerCase();
  if (flag === "false" || flag === "disable") return { connectionString, ssl: false };
  const enabled = sslFromUrl || flag === "true" || flag === "require" || flag === "no-verify";
  if (!enabled) return { connectionString, ssl: false };
  return { connectionString, ssl: { rejectUnauthorized: flag !== "no-verify" } };
}

export async function createPgDriver(url: string): Promise<Db> {
  const { Pool } = await import("pg");
  const settings = buildPgSettings(url);
  const pool = new Pool({
    ...settings,
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    // Managed/serverless Postgres (Neon, Supabase…) closes idle connections
    // and suspends idle databases; the first connection after a pause can be slow.
    connectionTimeoutMillis: 20_000,
    idleTimeoutMillis: 10_000,
    keepAlive: true,
  });
  // Without a listener, a connection dropped by the server while idle
  // would crash the whole process. The pool discards it and reconnects.
  pool.on("error", (error) => {
    console.warn("[db] idle connection error (will reconnect):", error.message);
  });

  type Queryable = {
    query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }>;
  };

  const wrap = (q: Queryable, inTx: boolean): Db => {
    const self: Db = {
      async query<T>(text: string, params?: unknown[]) {
        const res = await q.query(text, params);
        return { rows: res.rows as T[], rowCount: res.rowCount ?? 0 };
      },
      async exec(sql: string) {
        await q.query(sql);
      },
      async transaction<T>(fn: (tx: Db) => Promise<T>) {
        if (inTx) return fn(self); // nested: join the outer transaction
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const result = await fn(wrap(client, true));
          await client.query("COMMIT");
          return result;
        } catch (error) {
          await client.query("ROLLBACK").catch(() => undefined);
          throw error;
        } finally {
          client.release();
        }
      },
    };
    return self;
  };

  return wrap(pool, false);
}

export function resolvePgliteDataDir(): string | undefined {
  // In-memory for tests and for `next build` (which must not touch a
  // developer's persistent data); on disk for local `next dev`.
  if (process.env.NODE_ENV === "test") return undefined;
  if (process.env.NEXT_PHASE === "phase-production-build") return undefined;
  return process.env.PGLITE_DATA_DIR ?? path.join(process.cwd(), "storage", "pgdata");
}

export async function createPgliteDriver(dataDir?: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = dataDir ? new PGlite(dataDir) : new PGlite();
  await pg.waitReady;

  type PgQ = {
    query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[]; affectedRows?: number }>;
    exec: (sql: string) => Promise<unknown>;
  };

  const wrap = (q: PgQ, inTx: boolean): Db => {
    const self: Db = {
      async query<T>(text: string, params?: unknown[]) {
        const res = await q.query(text, params);
        const rows = res.rows as T[];
        return { rows, rowCount: rows.length > 0 ? rows.length : (res.affectedRows ?? 0) };
      },
      async exec(sql: string) {
        await q.exec(sql);
      },
      async transaction<T>(fn: (tx: Db) => Promise<T>) {
        if (inTx) return fn(self);
        return pg.transaction((tx) => fn(wrap(tx as unknown as PgQ, true)));
      },
    };
    return self;
  };

  return wrap(pg as unknown as PgQ, false);
}
