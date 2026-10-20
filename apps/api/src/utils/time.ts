/** Time helpers. All timestamps are ISO-8601 UTC strings. */

export function nowIso(): string {
  return new Date().toISOString();
}

export function iso(date: Date): string {
  return date.toISOString();
}

export function addMinutes(minutes: number, from = new Date()): string {
  return new Date(from.getTime() + minutes * 60_000).toISOString();
}

export function addDays(days: number, from = new Date()): string {
  return new Date(from.getTime() + days * 86_400_000).toISOString();
}

export function isPast(isoDate: string | null | undefined): boolean {
  if (!isoDate) return false;
  return Date.parse(isoDate) <= Date.now();
}

/** ISO-8601 week key, e.g. "2026-W42" (weeks start on Monday). */
export function isoWeekKey(input: Date | string): string {
  const date = typeof input === "string" ? new Date(input) : new Date(input.getTime());
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7; // Sunday -> 7
  utc.setUTCDate(utc.getUTCDate() + 4 - day); // nearest Thursday
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Monday 00:00:00 UTC .. Sunday 23:59:59.999 UTC for the week of `input`. */
export function weekBounds(input: Date | string = new Date()): { start: string; end: string } {
  const date = typeof input === "string" ? new Date(input) : new Date(input.getTime());
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  const start = new Date(utc);
  start.setUTCDate(utc.getUTCDate() - (day - 1));
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);
  end.setUTCMilliseconds(end.getMilliseconds() - 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function startOfDayIso(input: Date | string = new Date()): string {
  const date = typeof input === "string" ? new Date(input) : input;
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  ).toISOString();
}

export function startOfMonthIso(input: Date | string = new Date()): string {
  const date = typeof input === "string" ? new Date(input) : input;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString();
}

export function daysAgo(days: number): string {
  return addDays(-days);
}

/** Sequential ISO week keys ending at the current week (oldest first). */
export function recentWeekKeys(count: number, from = new Date()): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(from.getTime() - i * 7 * 86_400_000);
    keys.push(isoWeekKey(date));
  }
  return keys;
}

export function formatCsvTimestamp(isoDate: string): string {
  return isoDate.replace("T", " ").replace("Z", " UTC");
}
