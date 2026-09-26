/**
 * One day's figure for a cumulative health metric, from the rows stored
 * for that day.
 *
 * A day can legitimately hold two kinds of row for the same metric:
 *
 *  - a whole-day rollup, `dedup_key = daily-<type>-<day>`, written from
 *    HealthKit's own statistics query (areta-mobile's
 *    fetchRecentDailyTotals / fetchDailyStatistics). Overlapping iPhone
 *    and Watch sources are already merged in it, so it is the same number
 *    the Health app shows;
 *  - the raw samples the anchored stream posted for that day.
 *
 * Adding them together counts the day twice. The rollup therefore wins
 * outright wherever it exists — the rule aggregate.ts already applies to
 * steps and heart rate, stated once here for the metrics that are read
 * straight out of health_metrics (active energy, the distances) rather
 * than through activity_daily_summaries.
 */
export type DayMetricRow = { value: number | null; dedup_key: string | null };

export function dayMetricTotal(rows: DayMetricRow[] | null | undefined): number | null {
  if (!rows || rows.length === 0) return null;
  const rollup = rows.find((r) => (r.dedup_key ?? "").startsWith("daily-"));
  if (rollup) return rollup.value ?? null;
  const sum = rows.reduce((total, r) => total + (r.value ?? 0), 0);
  return sum;
}
