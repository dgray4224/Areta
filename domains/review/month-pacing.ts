/**
 * Month pacing — how this month is going against the user's own recent
 * months, honestly, while the month is still in progress.
 *
 * The honesty rule: a month in progress is compared to the SAME NUMBER
 * OF DAYS into each baseline month, never to their full totals. Twelve
 * days of September against all of August loses every time until the
 * 28th, which is the opposite of motivating and also just wrong. The
 * projection ("on pace for …") is what gets compared to full months.
 *
 * Two baselines: the trailing three months (what "usual" means right
 * now) and the same month last year (seasonal context — a quiet August
 * against a busy May is a season, not a slump). Both are averages over
 * only the months that actually have data, and a metric with no usable
 * baseline is reported as such rather than compared to zero.
 *
 * Pure: the route/service feeds it rows, this decides nothing about
 * where they came from.
 */

export type MonthPacingRow = {
  day: string;
  steps_total: number | null;
  workout_count: number | null;
  workout_total_minutes: number | null;
  sleep_logged: boolean | null;
  sleep_total_duration_minutes: number | null;
};

export type MonthPacingInput = {
  /** Every summary row from 13 months before the target month through
   * the end of it (or today). Order does not matter. */
  rows: MonthPacingRow[];
  /** YYYY-MM-DD days with at least one nutrition log, same span. */
  nutritionDays: string[];
  /** Target month, YYYY-MM. */
  month: string;
  /** User-local today, YYYY-MM-DD. */
  today: string;
};

export type MonthMetricKey = "steps" | "workouts" | "trainingMinutes" | "sleepHours" | "foodDays";

export type MonthMetric = {
  key: MonthMetricKey;
  label: string;
  /** "total" metrics accumulate over the month; "average" metrics are a
   * per-logged-day mean and project to themselves. */
  kind: "total" | "average";
  /** This month, through the elapsed days. */
  toDate: number;
  /** Average of the trailing three months over the same elapsed days. */
  sameDayTrailing: number | null;
  /** Same month last year over the same elapsed days. */
  sameDayLastYear: number | null;
  /** Full-month projection at the current rate (totals) or the current
   * average (averages). Null when nothing has been logged yet. */
  projected: number | null;
  /** The previous month's full value — the number to beat. */
  lastMonthFull: number | null;
  /** Average full value of the trailing three months. */
  trailingFull: number | null;
  /** Percent difference of toDate against sameDayTrailing. */
  deltaPercent: number | null;
  direction: "ahead" | "behind" | "even" | null;
  /** Both this month and at least one baseline month have data. */
  usable: boolean;
  /** The trailing three months' full values, oldest first — the bars a
   * month-end card draws next to this month. */
  trailingMonths: { month: string; label: string; value: number | null }[];
};

export type MonthPacing = {
  month: string;
  /** "September 2026" */
  monthLabel: string;
  /** "August" */
  lastMonthLabel: string;
  daysElapsed: number;
  daysInMonth: number;
  /** The month has fully ended (today is past it). */
  complete: boolean;
  metrics: MonthMetric[];
};

const EVEN_BAND_PERCENT = 5;
const TRAILING_MONTHS = 3;
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type Aggregate = { total: number; loggedDays: number };

type MetricDef = {
  key: MonthMetricKey;
  label: string;
  kind: "total" | "average";
  /** Contribution of one day, or null when the day has nothing for it. */
  dayValue: (row: MonthPacingRow | undefined, day: string, nutritionDays: Set<string>) => number | null;
};

const METRICS: MetricDef[] = [
  { key: "steps", label: "Steps", kind: "total", dayValue: (r) => (r && (r.steps_total ?? 0) > 0 ? r.steps_total : null) },
  { key: "workouts", label: "Workouts", kind: "total", dayValue: (r) => (r && (r.workout_count ?? 0) > 0 ? r.workout_count : null) },
  {
    key: "trainingMinutes",
    label: "Training minutes",
    kind: "total",
    dayValue: (r) => (r && (r.workout_total_minutes ?? 0) > 0 ? r.workout_total_minutes : null),
  },
  {
    key: "sleepHours",
    label: "Sleep",
    kind: "average",
    dayValue: (r) =>
      r && r.sleep_logged && (r.sleep_total_duration_minutes ?? 0) > 0 ? (r.sleep_total_duration_minutes ?? 0) / 60 : null,
  },
  { key: "foodDays", label: "Days with food logged", kind: "total", dayValue: (_r, day, food) => (food.has(day) ? 1 : null) },
];

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(month: string, withYear = true): string {
  const [y, m] = month.split("-").map(Number);
  return withYear ? `${MONTH_NAMES[m - 1]} ${y}` : MONTH_NAMES[m - 1];
}

function dayKey(month: string, dayOfMonth: number): string {
  return `${month}-${String(dayOfMonth).padStart(2, "0")}`;
}

/** Aggregate one metric over days 1..throughDay of a month. */
function aggregate(
  def: MetricDef,
  byDay: Map<string, MonthPacingRow>,
  nutritionDays: Set<string>,
  month: string,
  throughDay: number
): Aggregate {
  const last = Math.min(throughDay, daysInMonth(month));
  let total = 0;
  let loggedDays = 0;
  for (let d = 1; d <= last; d++) {
    const day = dayKey(month, d);
    const value = def.dayValue(byDay.get(day), day, nutritionDays);
    if (value === null) continue;
    total += value;
    loggedDays += 1;
  }
  return { total, loggedDays };
}

function valueOf(def: MetricDef, agg: Aggregate): number | null {
  if (agg.loggedDays === 0) return null;
  return def.kind === "average" ? agg.total / agg.loggedDays : agg.total;
}

function mean(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return null;
  return present.reduce((a, b) => a + b, 0) / present.length;
}

function round(value: number | null, kind: "total" | "average"): number | null {
  if (value === null) return null;
  return kind === "average" ? Math.round(value * 10) / 10 : Math.round(value);
}

/** Lead-metric order for a recap: the metric most people have, first. */
const RECAP_PRIORITY: MonthMetricKey[] = ["steps", "workouts", "trainingMinutes", "sleepHours", "foodDays"];

export function formatMonthValue(metric: Pick<MonthMetric, "key">, value: number): string {
  switch (metric.key) {
    case "steps":
      return `${value.toLocaleString("en-US")} steps`;
    case "workouts":
      return `${value} ${value === 1 ? "workout" : "workouts"}`;
    case "trainingMinutes":
      return `${value.toLocaleString("en-US")} minutes of training`;
    case "sleepHours":
      return `${value}h of sleep a night`;
    case "foodDays":
      return `${value} ${value === 1 ? "day" : "days"} with food logged`;
  }
}

/** "15% more than your usual month" / "about your usual" / "12% less than
 * your usual month". Neutral on purpose: less sleep is not "worse" in a
 * sentence the app cannot contextualize. */
export function describeMonthDelta(metric: Pick<MonthMetric, "deltaPercent" | "direction">): string | null {
  if (metric.deltaPercent === null || metric.direction === null) return null;
  if (metric.direction === "even") return "about your usual";
  const magnitude = Math.abs(metric.deltaPercent);
  return metric.direction === "ahead" ? `${magnitude}% more than your usual month` : `${magnitude}% less than your usual month`;
}

/** The usable metrics of a completed month in recap order, lead first. */
export function recapMetrics(pacing: MonthPacing): MonthMetric[] {
  return RECAP_PRIORITY.map((key) => pacing.metrics.find((m) => m.key === key)).filter(
    (m): m is MonthMetric => m !== undefined && m.usable
  );
}

export function computeMonthPacing(input: MonthPacingInput): MonthPacing {
  const { month, today } = input;
  const totalDays = daysInMonth(month);
  const todayMonth = today.slice(0, 7);
  const complete = todayMonth > month;
  // Days of the month that have happened. A future month has none.
  const daysElapsed = complete ? totalDays : todayMonth === month ? Number(today.slice(8, 10)) : 0;

  const byDay = new Map(input.rows.map((r) => [r.day, r]));
  const nutritionDays = new Set(input.nutritionDays);
  const trailing = Array.from({ length: TRAILING_MONTHS }, (_, i) => shiftMonth(month, -(i + 1)));
  const lastYear = shiftMonth(month, -12);

  const metrics: MonthMetric[] = METRICS.map((def) => {
    const current = aggregate(def, byDay, nutritionDays, month, daysElapsed);
    const toDateValue = valueOf(def, current);
    const toDate = round(toDateValue, def.kind) ?? 0;

    const sameDayTrailing = mean(trailing.map((m) => valueOf(def, aggregate(def, byDay, nutritionDays, m, daysElapsed))));
    const sameDayLastYear = valueOf(def, aggregate(def, byDay, nutritionDays, lastYear, daysElapsed));
    const trailingMonths = [...trailing].reverse().map((m) => ({
      month: m,
      label: monthLabel(m, false).slice(0, 3),
      value: round(valueOf(def, aggregate(def, byDay, nutritionDays, m, daysInMonth(m))), def.kind),
    }));
    const trailingFull = mean(trailingMonths.map((m) => m.value));
    const lastMonthFull = trailingMonths[trailingMonths.length - 1]?.value ?? null;

    let projected: number | null = null;
    if (toDateValue !== null && daysElapsed > 0) {
      projected = def.kind === "average" ? toDateValue : (toDateValue / daysElapsed) * totalDays;
    }

    let deltaPercent: number | null = null;
    let direction: MonthMetric["direction"] = null;
    if (toDateValue !== null && sameDayTrailing !== null && sameDayTrailing > 0) {
      deltaPercent = Math.round(((toDateValue - sameDayTrailing) / sameDayTrailing) * 100);
      direction = deltaPercent >= EVEN_BAND_PERCENT ? "ahead" : deltaPercent <= -EVEN_BAND_PERCENT ? "behind" : "even";
    }

    return {
      key: def.key,
      label: def.label,
      kind: def.kind,
      toDate,
      sameDayTrailing: round(sameDayTrailing, def.kind),
      sameDayLastYear: round(sameDayLastYear, def.kind),
      projected: round(projected, def.kind),
      lastMonthFull: round(lastMonthFull, def.kind),
      trailingFull: round(trailingFull, def.kind),
      deltaPercent,
      direction,
      usable: toDateValue !== null && (sameDayTrailing !== null || sameDayLastYear !== null),
      trailingMonths,
    };
  });

  return {
    month,
    monthLabel: monthLabel(month),
    lastMonthLabel: monthLabel(trailing[0], false),
    daysElapsed,
    daysInMonth: totalDays,
    complete,
    metrics,
  };
}
