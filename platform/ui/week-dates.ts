/** The Sun-Sat calendar dates for the week containing `anchor`, as
 * YYYY-MM-DD strings — index i matches day_of_week i (0=Sun..6=Sat). */
export function getWeekDates(anchor: string): string[] {
  const d = new Date(`${anchor}T00:00:00Z`);
  const sunday = new Date(d);
  sunday.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(sunday);
    dt.setUTCDate(sunday.getUTCDate() + i);
    return dt.toISOString().slice(0, 10);
  });
}

export function formatShortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
