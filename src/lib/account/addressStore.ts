import type { Address } from "@/types/catalog";
import { getDb } from "@/lib/db";
import type { Db } from "@/lib/db/client";
import { num } from "@/lib/db/rows";

export const MAX_ADDRESSES = 3;

export type SavedAddress = { id: number; label?: string; address: Address; isDefault: boolean };

type Row = { id: number; label: string | null; address: Address; is_default: boolean };
const toSaved = (r: Row): SavedAddress => ({
  id: num(r.id),
  ...(r.label ? { label: r.label } : {}),
  address: r.address,
  isDefault: r.is_default,
});

async function listWith(db: Pick<Db, "query">, customerId: number): Promise<SavedAddress[]> {
  const res = await db.query<Row>(
    "SELECT id, label, address, is_default FROM customer_addresses WHERE customer_id = $1 ORDER BY is_default DESC, id",
    [customerId]
  );
  return res.rows.map(toSaved);
}

export const listAddresses = async (customerId: number) => listWith(await getDb(), customerId);

/** Keeps customers.address (used to prefill checkout) equal to the default address. */
async function syncLegacy(tx: Pick<Db, "query">, customerId: number) {
  await tx.query(
    `UPDATE customers SET address = (
       SELECT address FROM customer_addresses WHERE customer_id = $1 AND is_default LIMIT 1
     ) WHERE id = $1`,
    [customerId]
  );
}

/** Row-locks the customer so two simultaneous requests cannot both pass the limit check. */
const lock = (tx: Pick<Db, "query">, customerId: number) =>
  tx.query("SELECT id FROM customers WHERE id = $1 FOR UPDATE", [customerId]);

export async function addAddress(
  customerId: number,
  input: { address: Address; label?: string; makeDefault?: boolean }
): Promise<SavedAddress | "limit_reached"> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    await lock(tx, customerId);
    const count = num((await tx.query<{ n: number }>("SELECT count(*)::int AS n FROM customer_addresses WHERE customer_id = $1", [customerId])).rows[0].n);
    if (count >= MAX_ADDRESSES) return "limit_reached" as const;
    // The first address is always the default.
    const isDefault = count === 0 || Boolean(input.makeDefault);
    if (isDefault) await tx.query("UPDATE customer_addresses SET is_default = false WHERE customer_id = $1", [customerId]);
    const res = await tx.query<Row>(
      "INSERT INTO customer_addresses (customer_id, label, address, is_default) VALUES ($1,$2,$3::jsonb,$4) RETURNING id, label, address, is_default",
      [customerId, input.label || null, JSON.stringify(input.address), isDefault]
    );
    await syncLegacy(tx, customerId);
    return toSaved(res.rows[0]);
  });
}

export async function updateAddress(
  customerId: number,
  id: number,
  input: { address: Address; label?: string; makeDefault?: boolean }
): Promise<SavedAddress | undefined> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    await lock(tx, customerId);
    if (input.makeDefault) await tx.query("UPDATE customer_addresses SET is_default = false WHERE customer_id = $1", [customerId]);
    const res = await tx.query<Row>(
      `UPDATE customer_addresses SET address = $3::jsonb, label = $4, is_default = is_default OR $5
        WHERE id = $2 AND customer_id = $1 RETURNING id, label, address, is_default`,
      [customerId, id, JSON.stringify(input.address), input.label || null, Boolean(input.makeDefault)]
    );
    if (!res.rows[0]) return undefined;
    await syncLegacy(tx, customerId);
    return toSaved(res.rows[0]);
  });
}

export async function setDefaultAddress(customerId: number, id: number): Promise<boolean> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    await lock(tx, customerId);
    const own = await tx.query("SELECT 1 FROM customer_addresses WHERE id = $1 AND customer_id = $2", [id, customerId]);
    if (!own.rows[0]) return false;
    // Two statements: a unique index is checked per row, so flipping both in one UPDATE can collide.
    await tx.query("UPDATE customer_addresses SET is_default = false WHERE customer_id = $1 AND is_default", [customerId]);
    await tx.query("UPDATE customer_addresses SET is_default = true WHERE id = $2 AND customer_id = $1", [customerId, id]);
    await syncLegacy(tx, customerId);
    return true;
  });
}

/** Deleting the default promotes the oldest remaining address. */
export async function deleteAddress(customerId: number, id: number): Promise<boolean> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    await lock(tx, customerId);
    const del = await tx.query<{ is_default: boolean }>(
      "DELETE FROM customer_addresses WHERE id = $1 AND customer_id = $2 RETURNING is_default",
      [id, customerId]
    );
    if (!del.rows[0]) return false;
    if (del.rows[0].is_default) {
      await tx.query(
        `UPDATE customer_addresses SET is_default = true
          WHERE id = (SELECT id FROM customer_addresses WHERE customer_id = $1 ORDER BY id LIMIT 1)`,
        [customerId]
      );
    }
    await syncLegacy(tx, customerId);
    return true;
  });
}
