/**
 * The person's own training history as a baseline for this week.
 *
 * Read straight from activity_daily_summaries (imported Apple Health
 * history, bucketed by local day) rather than from past weekly_reviews
 * rows, so it works on a brand-new account's very first brief and for
 * accounts whose older reviews predate training metrics. The brief uses
 * it to hold the plan up against what the person has already proven they
 * can do ("two months ago you trained 6 days a week for a month
 * straight").
 *
 * Unit is training days (days with any recorded workout), the same unit
 * as metrics.trainingDays and as planned sessions, so the three can be
 * compared directly.
 */

export const BASELINE_WEEKS = 52;
const STRETCH_WEEKS = 4;
const DAY_MS = 86_400_000;

export type TrainingDay = { date: string; workoutMinutes: number; steps: number };

export type TrainingStretch = {
  averageDaysPerWeek: number;
  /** Fewest training days in any single week of the stretch — how
   * consistent it was, not just how high the average ran. */
  fewestDaysInAWeek: number;
  startDate: string;
  endDate: string;
  endedWeeksAgo: number;
  /** Plain-English when, computed here because the model got it wrong
   * ("two winters ago" for a stretch 9 months back): e.g.
   * "December 2025 to January 2026, about 9 months ago". */
  when: string;
};

export type TrainingBaseline = {
  thisWeekDays: number;
  /** Average training days per week over the prior N weeks, counting only
   * weeks the phone saw at all. Null when none were seen. */
  last4WeeksAverageDays: number | null;
  last12WeeksAverageDays: number | null;
  last52WeeksAverageDays: number | null;
  last4WeeksAverageMinutes: number | null;
  /** Best run of 4 consecutive tracked weeks in the past year. */
  bestStretch: TrainingStretch | null;
  /** Their single best week in the prior 12 (ties go to the most recent),
   * and whether this week matched or beat it — the only grounds for
   * calling this week their best "in months". */
  bestWeekLast12: { days: number; startDate: string; weeksAgo: number } | null;
  thisWeekMatchesOrBeatsLast12: boolean;
  weeksOfHistory: number;
  /** Whether their best stretch reached the planned sessions per week —
   * the only grounds for "you've done this plan before". Null without a
   * plan or a stretch. */
  bestStretchReachesPlan: boolean | null;
};

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthYear(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "about 9 months ago", "about 5 weeks ago", "last month". */
export function describeAgo(weeksAgo: number): string {
  if (weeksAgo <= 1) return "last week";
  if (weeksAgo < 8) return `about ${weeksAgo} weeks ago`;
  const months = Math.round(weeksAgo / 4.345);
  return months >= 12 ? "about a year ago" : `about ${months} months ago`;
}

function describeStretch(startDate: string, endDate: string, weeksAgo: number): string {
  const start = monthYear(startDate);
  const end = monthYear(endDate);
  return `${start === end ? start : `${start} to ${end}`}, ${describeAgo(weeksAgo)}`;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

type Week = { start: string; end: string; tracked: boolean; days: number; minutes: number };

/**
 * @param weekStart first day of the week the brief reports on.
 * A week with no summary rows at all (no steps, no workouts) is
 * "untracked" and left out of every average: a phone that wasn't
 * recording is not a week off.
 */
export function computeTrainingBaseline(
  weekStart: string,
  days: TrainingDay[],
  plannedSessions = 0
): TrainingBaseline {
  const byDate = new Map(days.map((d) => [d.date, d]));

  const weeks: Week[] = [];
  for (let k = 0; k <= BASELINE_WEEKS; k++) {
    const start = addDays(weekStart, -7 * k);
    let tracked = false;
    let trainingDays = 0;
    let minutes = 0;
    for (let i = 0; i < 7; i++) {
      const d = byDate.get(addDays(start, i));
      if (!d) continue;
      if (d.steps > 0 || d.workoutMinutes > 0) tracked = true;
      if (d.workoutMinutes > 0) {
        trainingDays++;
        minutes += d.workoutMinutes;
      }
    }
    weeks.push({ start, end: addDays(start, 6), tracked, days: trainingDays, minutes });
  }

  const [current, ...past] = weeks;

  const average = (span: number, pick: (w: Week) => number): number | null => {
    const tracked = past.slice(0, span).filter((w) => w.tracked);
    if (tracked.length === 0) return null;
    return round1(tracked.reduce((sum, w) => sum + pick(w), 0) / tracked.length);
  };

  let bestStretch: TrainingStretch | null = null;
  for (let i = 0; i + STRETCH_WEEKS <= past.length; i++) {
    const run = past.slice(i, i + STRETCH_WEEKS);
    if (!run.every((w) => w.tracked)) continue;
    const avg = round1(run.reduce((sum, w) => sum + w.days, 0) / STRETCH_WEEKS);
    // Strictly greater keeps the most recent of equally good stretches.
    if (!bestStretch || avg > bestStretch.averageDaysPerWeek) {
      bestStretch = {
        averageDaysPerWeek: avg,
        fewestDaysInAWeek: Math.min(...run.map((w) => w.days)),
        startDate: run[run.length - 1].start,
        endDate: run[0].end,
        endedWeeksAgo: i + 1,
        when: describeStretch(run[run.length - 1].start, run[0].end, i + 1),
      };
    }
  }
  if (bestStretch && bestStretch.averageDaysPerWeek === 0) bestStretch = null;

  let bestWeekLast12: TrainingBaseline["bestWeekLast12"] = null;
  for (let i = 0; i < 12; i++) {
    const w = past[i];
    if (!w.tracked) continue;
    if (!bestWeekLast12 || w.days > bestWeekLast12.days) {
      bestWeekLast12 = { days: w.days, startDate: w.start, weeksAgo: i + 1 };
    }
  }

  return {
    thisWeekDays: current.days,
    last4WeeksAverageDays: average(4, (w) => w.days),
    last12WeeksAverageDays: average(12, (w) => w.days),
    last52WeeksAverageDays: average(BASELINE_WEEKS, (w) => w.days),
    last4WeeksAverageMinutes: average(4, (w) => w.minutes),
    bestStretch,
    bestWeekLast12,
    thisWeekMatchesOrBeatsLast12: bestWeekLast12 !== null && current.days >= bestWeekLast12.days,
    weeksOfHistory: past.filter((w) => w.tracked).length,
    bestStretchReachesPlan:
      plannedSessions > 0 && bestStretch ? bestStretch.averageDaysPerWeek >= plannedSessions : null,
  };
}
