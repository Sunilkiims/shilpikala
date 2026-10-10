import { getDb, getDbKind } from "../src/lib/db";
(async () => {
  const db = await getDb();
  const p = await db.query("SELECT count(*)::int AS n FROM products");
  const c = await db.query("SELECT count(*)::int AS n FROM categories");
  const nx = await db.query("INSERT INTO categories (name,slug) VALUES ('T','t-x') RETURNING id");
  console.log(getDbKind(), p.rows, c.rows, nx.rows);
  try { await db.transaction(async (tx) => { await tx.query("DELETE FROM categories WHERE slug='t-x'"); throw new Error("x"); }); } catch {}
  console.log("after rollback", (await db.query("SELECT count(*)::int n FROM categories WHERE slug='t-x'")).rows);
  process.exit(0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
