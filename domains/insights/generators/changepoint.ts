/**
 * Changepoint detection on a daily series (Insights Layer, 2026-08-17).
 *
 * The hook of the whole layer: structural breaks in the mean of someone's
 * daily step count. Most people have never consciously registered these
 * moments, which is exactly what makes them worth showing -- a peak month
 * is trivia, but "your daily average changed in September 2024 and never
 * changed back" is a question about their life.
 *
 * Method: recursive binary segmentation on the Welch t-statistic. For each
 * candidate split we ask how many standard errors apart the two segment
 * means are, take the strongest split in the window, and recurse into both
 * halves if it clears the threshold. Chosen over CUSUM or a full PELT fit
 * because it needs no tuning constant beyond the threshold, degrades
 * gracefully on short series, and -- mattering most here -- produces a
 * statistic we can explain: this is a t-test between the days before and
 * the days after.
 *
 * COPY DISCIPLINE: this function will surface deaths, diagnoses, divorces,
 * and layoffs. It returns direction as 'up'/'down' and nothing else. It
 * does not know, and must never appear to know, whether a break was good.
 */

export type SeriesPoint = { day: string; value: number };

export type Changepoint = {
  day: string;
  direction: "up" | "down";
  meanBefore: number;
  meanAfter: number;
  daysBefore: number;
  daysAfter: number;
  /** Welch t-statistic at the split, as a rough confidence proxy. */
  tStatistic: number;
};

/**
 * A break needs real life on both sides. Three weeks is the shortest
 * window that cannot be produced by a holiday, an illness, or a single
 * unusual fortnight -- below that you are detecting weather.
 */
const MIN_SEGMENT_DAYS = 21;

/**
 * Welch t of ~4 across three-plus weeks each side is a large, sustained
 * shift, not noise. Tuned to be conservative on purpose: a false
 * changepoint asks the user "what changed in March?" when nothing did,
 * which is worse than silence because it teaches them the app guesses.
 */
const MIN_T_STATISTIC = 4;

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function variance(values: number[], m: number): number {
  if (values.length < 2) return 0;
  return values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
}

/** Welch's t — unequal variances, which is the norm here: the whole point
 * is that the two segments are not the same distribution. */
function welchT(left: number[], right: number[]): number {
  const mLeft = mean(left);
  const mRight = mean(right);
  const vLeft = variance(left, mLeft);
  const vRight = variance(right, mRight);
  const se = Math.sqrt(vLeft / left.length + vRight / right.length);
  if (se === 0) return 0;
  return Math.abs(mRight - mLeft) / se;
}

/** Strongest split in [start, end), or null if none clears the threshold. */
function strongestSplit(values: number[], start: number, end: number): { index: number; t: number } | null {
  let best: { index: number; t: number } | null = null;
  for (let i = start + MIN_SEGMENT_DAYS; i <= end - MIN_SEGMENT_DAYS; i++) {
    const t = welchT(values.slice(start, i), values.slice(i, end));
    if (best === null || t > best.t) best = { index: i, t };
  }
  return best !== null && best.t >= MIN_T_STATISTIC ? best : null;
}

/**
 * Detects changepoints in a daily series, most significant first.
 *
 * `series` must be ascending by day and gap-filled by the caller -- a
 * missing day is not a zero-step day, and treating it as one manufactures
 * breaks at every holiday. See fillDailyGaps below.
 */
export function detectChangepoints(series: SeriesPoint[], maxPoints = 5): Changepoint[] {
  // Detect WITHIN contiguous stretches only, never across a recording gap.
  //
  // Found while testing against real data: a user's history is not one
  // continuous series. Phones get replaced, permission gets revoked and
  // re-granted, people stop carrying the thing. One real account jumped
  // 2024-11-12 -> 2026-06-14 with nothing between, at a much higher step
  // level on the far side. Because missing days are dropped rather than
  // zeroed, those two days sit adjacent in the array, and the detector
  // happily reported a monster changepoint at the seam — which is not a
  // change in the person's life, it is the day they got a new phone.
  //
  // That class of false finding is the worst one this feature can produce:
  // it is maximally confident, and it asks the user "what changed in June
  // 2026?" when the honest answer is "nothing, we just started watching".
  return splitOnGaps(series)
    .flatMap((run) => detectWithinContiguousRun(run, maxPoints))
    .sort((a, b) => b.tStatistic - a.tStatistic)
    .slice(0, maxPoints);
}

/**
 * A break longer than this ends a contiguous run. Two weeks is past any
 * holiday or illness and firmly into "was not recording" territory.
 */
const MAX_GAP_DAYS = 14;

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

function splitOnGaps(series: SeriesPoint[]): SeriesPoint[][] {
  const runs: SeriesPoint[][] = [];
  let current: SeriesPoint[] = [];
  for (const point of series) {
    const previous = current[current.length - 1];
    if (previous && daysBetween(previous.day, point.day) > MAX_GAP_DAYS) {
      runs.push(current);
      current = [];
    }
    current.push(point);
  }
  if (current.length > 0) runs.push(current);
  return runs;
}

function detectWithinContiguousRun(series: SeriesPoint[], maxPoints: number): Changepoint[] {
  if (series.length < MIN_SEGMENT_DAYS * 2) return [];

  const values = series.map((p) => p.value);
  const found: Changepoint[] = [];

  // Explicit stack rather than recursion: segment counts are small, but a
  // stack makes the "stop at maxPoints" cutoff obvious.
  const segments: [number, number][] = [[0, values.length]];
  while (segments.length > 0 && found.length < maxPoints) {
    const [start, end] = segments.pop()!;
    if (end - start < MIN_SEGMENT_DAYS * 2) continue;

    const split = strongestSplit(values, start, end);
    if (split === null) continue;

    const left = values.slice(start, split.index);
    const right = values.slice(split.index, end);
    const meanBefore = mean(left);
    const meanAfter = mean(right);

    found.push({
      day: series[split.index].day,
      direction: meanAfter >= meanBefore ? "up" : "down",
      meanBefore,
      meanAfter,
      daysBefore: left.length,
      daysAfter: right.length,
      tStatistic: split.t,
    });

    segments.push([start, split.index], [split.index, end]);
  }

  return found.sort((a, b) => b.tStatistic - a.tStatistic);
}

/**
 * Fills missing calendar days by carrying nothing -- days with no record
 * are DROPPED, not zeroed.
 *
 * A day with no step sample means the phone was off, left at home, or not
 * yet owned. Scoring that as a zero-step day invents a cliff at every such
 * gap and would make the most confident changepoint in most users' data an
 * artifact of a dead battery. Dropping them biases toward "days we
 * actually observed", which is the honest population.
 *
 * Returned series is ascending and deduplicated by day (last value wins).
 */
export function normalizeDailySeries(rows: { day: string; value: number | null }[]): SeriesPoint[] {
  const byDay = new Map<string, number>();
  for (const row of rows) {
    if (row.value === null || !Number.isFinite(row.value)) continue;
    byDay.set(row.day, row.value);
  }
  return [...byDay.entries()].map(([day, value]) => ({ day, value })).sort((a, b) => a.day.localeCompare(b.day));
}
