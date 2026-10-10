export function iso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}
export function num(value: unknown): number {
  return typeof value === "number" ? value : Number(value);
}
export function bytes(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  return Buffer.from(value as ArrayBuffer);
}
export function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "23505";
}
