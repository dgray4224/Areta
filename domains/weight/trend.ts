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
