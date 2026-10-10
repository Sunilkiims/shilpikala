/**
 * Applies pending migrations (and the one-time starter catalogue) to the
 * database named by DATABASE_URL. The app does this automatically on
 * first use; run this in a deploy step if you prefer to do it up front.
 *
 *   npm run db:migrate
 */
import "./load-env";
import { getDb, getDbKind } from "../src/lib/db";

(async () => {
  const db = await getDb();
  const applied = await db.query<{ id: string }>("SELECT id FROM schema_migrations ORDER BY id");
  console.log(`Database ready (${getDbKind()}). Migrations applied: ${applied.rows.map((r) => r.id).join(", ")}`);
  process.exit(0);
})().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
