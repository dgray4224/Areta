export type WeightPoint = { loggedAt: string; weight: number };
export type WeightTrendPoint = WeightPoint & { sevenDayAverage: number };

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Deterministic trailing 7-day moving average (CLAUDE.md §7 Layer 3: "use
 * deterministic code for calculations" — moving averages specifically
 * called out, never an LLM). Pure function, no I/O, so it's directly unit
 * testable.
 */
export function computeSevenDayMovingAverage(points: WeightPoint[]): WeightTrendPoint[] {
  const sorted = [...points].sort(
    (a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime()
  );

  return sorted.map((point, index) => {
    const windowStart = new Date(point.loggedAt).getTime() - SEVEN_DAYS_MS;
    const windowPoints = sorted
      .slice(0, index + 1)
      .filter((p) => new Date(p.loggedAt).getTime() > windowStart);
    const average =
      windowPoints.reduce((sum, p) => sum + p.weight, 0) / windowPoints.length;
    return { ...point, sevenDayAverage: Math.round(average * 10) / 10 };
  });
}

/**
 * How much the 7-day average has moved over roughly the last week — the
 * "insight" line on the Today hero card. Compares the latest average
 * against the earliest point at least 6 days before it, so it reads as a
 * week-over-week trend rather than noise from a single day-to-day swing.
 * Returns null when there isn't enough history yet to say anything.
 */
export function computeRecentWeightDelta(trend: WeightTrendPoint[]): number | null {
  if (trend.length === 0) return null;
  const latest = trend[trend.length - 1];
  const latestTime = new Date(latest.loggedAt).getTime();
  const priorWindowMs = 6 * 24 * 60 * 60 * 1000;

  const prior = [...trend].reverse().find((p) => latestTime - new Date(p.loggedAt).getTime() >= priorWindowMs);
  if (!prior) return null;

  return Math.round((latest.sevenDayAverage - prior.sevenDayAverage) * 10) / 10;
}
