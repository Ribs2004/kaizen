/** Returns YYYY-MM-DD for the given Date (local — matches what the user sees on their phone). */
export function toLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parses YYYY-MM-DD into a Date at local midnight. */
export function fromLocalDateString(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Returns the number of full days between two YYYY-MM-DD date strings (b - a). */
export function daysBetween(a: string, b: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const da = fromLocalDateString(a).getTime();
  const db = fromLocalDateString(b).getTime();
  return Math.round((db - da) / msPerDay);
}
