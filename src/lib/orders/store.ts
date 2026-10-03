import { mkdir, readFile, appendFile } from "node:fs/promises";
import path from "node:path";
import type { StoredOrder } from "@/lib/orders/types";

/**
 * Orders are appended as one JSON object per line to storage/orders.jsonl
 * at the project root. This is a Day 6 foundation, not a production
 * database: it works well on a normal Node server (your own VPS, Docker,
 * `next start`) but NOT on serverless hosts with a read-only filesystem
 * (e.g. Vercel, outside /tmp) — swap this module for a real database
 * before deploying there. Every function here is small and isolated
 * specifically so that swap only touches this one file.
 */

const STORAGE_DIR = path.join(process.cwd(), "storage");
const ORDERS_FILE = path.join(STORAGE_DIR, "orders.jsonl");

async function ensureStorageDir(): Promise<void> {
  await mkdir(STORAGE_DIR, { recursive: true });
}

export async function appendOrder(order: StoredOrder): Promise<void> {
  await ensureStorageDir();
  await appendFile(ORDERS_FILE, `${JSON.stringify(order)}\n`, "utf8");
}

async function readAllOrders(): Promise<StoredOrder[]> {
  try {
    const raw = await readFile(ORDERS_FILE, "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as StoredOrder);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function getOrderByRazorpayOrderId(
  razorpayOrderId: string
): Promise<StoredOrder | undefined> {
  const orders = await readAllOrders();
  return orders.find((order) => order.razorpayOrderId === razorpayOrderId);
}

export async function getOrderById(id: string): Promise<StoredOrder | undefined> {
  const orders = await readAllOrders();
  return orders.find((order) => order.id === id);
}

export async function getAllOrders(): Promise<StoredOrder[]> {
  const orders = await readAllOrders();
  return orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
