import { getDb } from "@/lib/db";
import { num } from "@/lib/db/rows";

export type DashboardStats = {
  orders: number;
  revenue: number;
  ordersLast30Days: number;
  revenueLast30Days: number;
  toFulfil: number;
  newInquiries: number;
  pendingReviews: number;
  openPaymentIssues: number;
  lowStock: { id: number; name: string; stockQuantity: number }[];
  topProducts: { name: string; units: number }[];
};

export const LOW_STOCK_THRESHOLD = 3;

export async function getDashboardStats(): Promise<DashboardStats> {
  const db = await getDb();
  // Cancelled and refunded orders don't count as revenue.
  const totals = await db.query<Record<string, unknown>>(`
    SELECT
      count(*) FILTER (WHERE status NOT IN ('cancelled','refunded')) AS orders,
      COALESCE(sum(amount) FILTER (WHERE status NOT IN ('cancelled','refunded')), 0) AS revenue,
      count(*) FILTER (WHERE status NOT IN ('cancelled','refunded') AND created_at > now() - interval '30 days') AS orders30,
      COALESCE(sum(amount) FILTER (WHERE status NOT IN ('cancelled','refunded') AND created_at > now() - interval '30 days'), 0) AS revenue30,
      count(*) FILTER (WHERE status IN ('paid','processing')) AS to_fulfil
    FROM orders`);
  const t = totals.rows[0];

  const one = async (sql: string) => num((await db.query<{ n: unknown }>(sql)).rows[0].n);
  const newInquiries = await one("SELECT count(*) AS n FROM inquiries WHERE status = 'new'");
  const pendingReviews = await one("SELECT count(*) AS n FROM reviews WHERE status = 'pending'");
  const openPaymentIssues = await one("SELECT count(*) AS n FROM unreconciled_payments WHERE NOT resolved");

  const low = await db.query<{ id: number; name: string; stock_quantity: number }>(
    "SELECT id, name, stock_quantity FROM products WHERE stock_quantity IS NOT NULL AND stock_quantity <= $1 ORDER BY stock_quantity, id",
    [LOW_STOCK_THRESHOLD]
  );
  const top = await db.query<{ name: string; units: unknown }>(`
    SELECT item->>'name' AS name, sum((item->>'quantity')::int) AS units
      FROM orders, jsonb_array_elements(items) AS item
     WHERE status NOT IN ('cancelled','refunded')
     GROUP BY 1 ORDER BY units DESC, name LIMIT 5`);

  return {
    orders: num(t.orders),
    revenue: num(t.revenue),
    ordersLast30Days: num(t.orders30),
    revenueLast30Days: num(t.revenue30),
    toFulfil: num(t.to_fulfil),
    newInquiries,
    pendingReviews,
    openPaymentIssues,
    lowStock: low.rows.map((r) => ({ id: num(r.id), name: r.name, stockQuantity: num(r.stock_quantity) })),
    topProducts: top.rows.map((r) => ({ name: r.name, units: num(r.units) })),
  };
}
