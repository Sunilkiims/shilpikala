import { revalidatePath } from "next/cache";

/**
 * Storefront pages are cached for speed. After an admin change we drop
 * that cache so visitors see it immediately instead of after the timed
 * refresh. Outside a running Next server (unit tests) there is nothing
 * to invalidate, so failures are ignored.
 */
export function refreshStorefront(): void {
  try {
    revalidatePath("/", "layout");
  } catch {
    /* not running inside Next */
  }
}

/** Wraps an admin route handler: on a successful response, refresh the storefront. */
export function refreshAfter<A extends unknown[]>(
  handler: (...args: A) => Promise<Response>
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    const response = await handler(...args);
    if (response.ok) refreshStorefront();
    return response;
  };
}
