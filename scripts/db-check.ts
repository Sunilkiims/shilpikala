/**
 * Shows which database the app is really using and how many rows each
 * table holds — run it to confirm your data is going to PostgreSQL.
 *
 *   npm run db:check
 */
import { getDb, getDbKind } from "../src/lib/db";

const tables = [
  "categories", "products", "product_images", "customers", "sessions", "orders",
  "pending_orders", "unreconciled_payments", "reviews", "inquiries", "blog_posts",
];

(async () => {
  const db = await getDb();
  const kind = getDbKind();
  const host = process.env.DATABASE_URL
    ? new URL(process.env.DATABASE_URL).host
    : "(embedded, storage/pgdata)";
  console.log(`Backend: ${kind === "postgres" ? "PostgreSQL" : "EMBEDDED (not PostgreSQL!)"}  Host: ${host}`);
  for (const t of tables) {
    const r = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${t}`);
    console.log(`  ${t.padEnd(22)} ${r.rows[0].n}`);
  }
  if (kind !== "postgres") {
    console.log("\nDATABASE_URL is not set, so data is NOT going to your PostgreSQL database.");
  }
  process.exit(0);
})().catch((e) => { console.error("Check failed:", e.message); process.exit(1); });
