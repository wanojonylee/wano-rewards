/** Opaque cursor pagination helpers (`{ items, nextCursor }`). */

export function encodeCursor(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeCursor<T>(cursor: string | undefined | null): T | null {
  if (!cursor) return null;
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

export function parseLimit(raw: unknown, fallback = 20, max = 50): number {
  const value = Number(Array.isArray(raw) ? raw[0] : raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(1, Math.trunc(value)));
}

/**
 * Builds a page response from `limit + 1` fetched rows.
 * `cursorOf` must return stable, monotonic fields (createdAt + id).
 */
export function toPage<T>(
  rows: T[],
  limit: number,
  cursorOf: (row: T) => Record<string, string>,
): { items: T[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  return {
    items,
    nextCursor: hasMore && last ? encodeCursor(cursorOf(last)) : null,
  };
}
