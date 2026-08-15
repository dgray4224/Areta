/** Insight Engine v2 (2026-08-14) — shared shapes for the detector battery.
 * Every detector is a pure function from DetectorInput to zero or more
 * InsightCandidates; domains/insights/service.ts owns fetching the input
 * once and persisting the survivors to the `insights` table. */

export type InsightGrain = "day" | "week" | "lifetime";

/** One local calendar day of already-aggregated activity — a straight
 * camelCase projection of activity_daily_summaries (see
 * domains/activity-summary/aggregate.ts for how rows are computed). */
export type DaySummary = {
  day: string; // YYYY-MM-DD, user-local
  dayOfWeek: number | null; // 0=Sunday .. 6=Saturday
  isWeekend: boolean | null;
  stepsTotal: number;
  stepsMostActiveLocalHour: number | null;
  sleepTotalDurationMinutes: number | null;
  workoutCount: number;
  workoutTotalMinutes: number;
  workoutFirstStartLocalHour: number | null;
};

/** Per-day task completion derived from daily_actions — only days that had
 * at least one task appear here. */
export type DayTaskCompletion = {
  day: string;
  totalTasks: number;
  completionPercent: number; // completed + partially_completed, 0-100
};

export type DetectorInput = {
  /** Rolling window (WINDOW_DAYS in service.ts), ascending by day. */
  summaries: DaySummary[];
  /** Same window, ascending, only days with >=1 task. */
  taskCompletions: DayTaskCompletion[];
  /** Full-history (retention-capped) lightweight rows for lifetime
   * records/milestones, ascending by day. */
  allTimeSummaries: { day: string; stepsTotal: number; workoutCount: number; workoutTotalMinutes: number }[];
  /** User-local today (YYYY-MM-DD). */
  today: string;
  /** Seed base so permutation p-values are reproducible per user+run. */
  seedKey: string;
};

/** Series payloads backing the share-card visualizations (archetype
 * cards, 2026-08-15). One per "shape of achievement" — the card layout
 * is chosen from `kind`, not from the insight type, so a new detector
 * only has to declare which archetype it is. All arrays are capped and
 * rounded at build time (see series.ts): GET /api/insights returns up to
 * 50 rows with facts inline, so these ride along on every feed fetch.
 *
 * Every one is OPTIONAL on the insight. Rows written before this shipped
 * have no series and never gain one (service.ts dedupes on
 * (user_id, dedupe_key) and plain-inserts — there is no update path), so
 * every consumer must degrade to the text-only card. */
export type FactSeries =
  /** One day towered over every day before it. */
  | { kind: "peak"; values: number[]; recordIndex: number; previousBest: number }
  /** A running total crossed a threshold — the time span is the story. */
  | { kind: "accumulation"; points: number[]; threshold: number; firstDay: string; lastDay: string }
  /** An unbroken run, with the days before it kept for contrast. */
  | { kind: "persistence"; cells: boolean[]; streakStartIndex: number; unit: "day" | "week" };

/** Anything that survives a jsonb round-trip intact. */
export type FactValue = string | number | boolean | null | FactSeries;

export type InsightCandidate = {
  type: string;
  grain: InsightGrain;
  periodStart: string | null;
  periodEnd: string | null;
  /** Ground-truth numbers backing the headline — the exact payload share
   * cards and the feed render from. Shape is per-detector; keep scalar
   * values scalar, and put any array/series data under a FactSeries so
   * the card renderers have one well-known shape to parse. */
  facts: Record<string, FactValue>;
  headline: string;
  /** 0-100 ranking used for feed order, the per-run pattern cap, and
   * (Phase 3) push eligibility. */
  score: number;
  dedupeKey: string;
};
