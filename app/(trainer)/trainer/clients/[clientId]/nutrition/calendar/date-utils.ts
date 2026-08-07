/** Plain calendar-grid date helpers -- separate from
 * domains/trainermealprogram/calendar-projection.ts's addDays/
 * sundayOfWeekContaining (which this reuses) since these are UI-grid
 * concerns (month bounds, month navigation) with no scheduling meaning
 * of their own. Exact mirror of the workout calendar's own
 * date-utils.ts. */
import { addDays, sundayOfWeekContaining } from "@/domains/trainermealprogram/calendar-projection";

export function currentMonthString(): string {
  return new Date().toISOString().slice(0, 7);
}

export function shiftMonth(monthStr: string, delta: number): string {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthBounds(monthStr: string): { start: string; end: string } {
  const [y, m] = monthStr.split("-").map(Number);
  const start = `${monthStr}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = `${monthStr}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

export function monthLabel(monthStr: string): string {
  const [y, m] = monthStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** The full Sunday-to-Saturday grid range covering the month, including
 * leading/trailing days from adjacent months -- what a real calendar
 * grid needs to render complete weeks. */
export function gridBounds(monthStr: string): { gridStart: string; gridEnd: string } {
  const { start, end } = monthBounds(monthStr);
  const gridStart = sundayOfWeekContaining(start);
  const endDow = new Date(`${end}T00:00:00Z`).getUTCDay();
  const gridEnd = addDays(end, 6 - endDow);
  return { gridStart, gridEnd };
}
