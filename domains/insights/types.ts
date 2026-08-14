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

export type InsightCandidate = {
  type: string;
  grain: InsightGrain;
  periodStart: string | null;
  periodEnd: string | null;
  /** Ground-truth numbers backing the headline — the exact payload share
   * cards and the feed render from. Shape is per-detector; keep every
   * value a number/string/boolean so it survives jsonb round-trips. */
  facts: Record<string, string | number | boolean | null>;
  headline: string;
  /** 0-100 ranking used for feed order, the per-run pattern cap, and
   * (Phase 3) push eligibility. */
  score: number;
  dedupeKey: string;
};
