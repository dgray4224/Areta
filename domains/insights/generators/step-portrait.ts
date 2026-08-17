/**
 * Tier 0/1 generators (Insights Layer, 2026-08-17).
 *
 * Everything here runs on passively-recorded movement alone — steps and
 * workout timing — so it works for someone who has never checked a box,
 * logged a meal, or owned a watch. That constraint is the point: the whole
 * launch surface has to function for a user who never logs a single thing,
 * and a phone in a pocket is the only sensor we can assume.
 *
 * Each generator produces at most one candidate and scores itself through
 * the shared scorer rather than picking a number, so all of them are
 * directly comparable to each other and to the older Tier 2 detectors.
 */

import type { InsightCandidate } from "../types";
import { goalRelevanceScore, sampleSizeScore, scoreCandidate, surpriseScore } from "../scoring";
import { detectChangepoints, normalizeDailySeries, type Changepoint, type SeriesPoint } from "./changepoint";

const GENERATOR_VERSION = 1;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export type StepPortraitInput = {
  /** Ascending, one entry per observed day. Days with no record must be
   * absent rather than zero — see normalizeDailySeries. */
  series: SeriesPoint[];
  /** Day-of-week per observed day, aligned to `series` by day string. */
  dayOfWeek: Map<string, number>;
  /** Most-active local hour per day, where known. */
  mostActiveHour: Map<string, number>;
  activeGoalDomains: Set<string>;
  today: string;
};

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((s, v) => s + v, 0) / values.length;
}

function monthKey(day: string): string {
  return day.slice(0, 7);
}

function formatMonth(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/** Rounds to the nearest hundred — a step count is not precise to the unit
 * and printing "7,431 steps" implies an accuracy the sensor does not have. */
function roundSteps(n: number): number {
  return Math.round(n / 100) * 100;
}

/**
 * The hook. A structural break in daily movement, described in strictly
 * neutral terms.
 *
 * COPY: `direction` never becomes "improved"/"declined" in the headline.
 * These breaks land on bereavements, diagnoses, and redundancies as often
 * as on new gym memberships, and the app has no idea which it is looking
 * at. "Your daily average changed" is the strongest claim it can honestly
 * make.
 */
export function generateChangepointInsight(
  input: StepPortraitInput,
  changepoints: Changepoint[]
): InsightCandidate | null {
  const top = changepoints[0];
  if (!top) return null;

  const before = roundSteps(top.meanBefore);
  const after = roundSteps(top.meanAfter);
  const shift = Math.abs(after - before);
  if (shift < 500) return null;

  const overall = mean(input.series.map((p) => p.value));
  const components = {
    // A break is only interesting relative to the person's own typical
    // day: 2,000 steps means something different to a 3,000-step user
    // than to a 12,000-step one.
    effectSize: Math.min(1, shift / Math.max(overall, 1)),
    sampleSize: sampleSizeScore(Math.min(top.daysBefore, top.daysAfter)),
    // Highly actionable in the only sense that matters here: it invites
    // the user to tell us what happened, which is the annotation loop.
    actionability: 0.8,
    goalRelevance: goalRelevanceScore("exercise", input.activeGoalDomains),
    // A sustained regime change is inherently surprising — people
    // routinely have no conscious memory of these moments. Baseline
    // expectation is "no break at all", so any confident break deviates.
    surprise: Math.min(1, 0.5 + top.tStatistic / 20),
  };
  const scored = scoreCandidate(components);

  return {
    type: "changepoint",
    grain: "lifetime",
    periodStart: top.day,
    periodEnd: input.today,
    facts: {
      day: top.day,
      direction: top.direction,
      meanBefore: before,
      meanAfter: after,
      daysBefore: top.daysBefore,
      daysAfter: top.daysAfter,
    },
    headline: `Around ${formatMonth(monthKey(top.day))}, your daily average ${
      top.direction === "up" ? "rose" : "fell"
    } from about ${before.toLocaleString()} to ${after.toLocaleString()} steps a day.`,
    score: scored.score,
    dedupeKey: `changepoint:steps:${top.day}`,
    tier: 1,
    generatorKey: "changepoint_steps",
    generatorVersion: GENERATOR_VERSION,
    scoreComponents: scored.components,
  };
}

/** Peak month, with a date. Trivia on its own, but it anchors the
 * archaeology screen in something concrete and checkable. */
export function generatePeakMonth(input: StepPortraitInput): InsightCandidate | null {
  const byMonth = new Map<string, number[]>();
  for (const point of input.series) {
    const key = monthKey(point.day);
    const bucket = byMonth.get(key);
    if (bucket) bucket.push(point.value);
    else byMonth.set(key, [point.value]);
  }

  // A month observed for under two weeks is not a month, it is a fragment
  // — and fragments win "peak" trivially by containing only good days.
  const complete = [...byMonth.entries()].filter(([, values]) => values.length >= 14);
  if (complete.length < 2) return null;

  const ranked = complete.map(([key, values]) => ({ key, avg: mean(values), days: values.length }));
  ranked.sort((a, b) => b.avg - a.avg);
  const peak = ranked[0];
  const rest = ranked.slice(1);
  const restAvg = mean(rest.map((m) => m.avg));
  if (restAvg <= 0) return null;

  const components = {
    effectSize: Math.min(1, (peak.avg - restAvg) / restAvg),
    sampleSize: sampleSizeScore(peak.days),
    // You cannot act on which month was busiest. Honest low score — this
    // exists as texture, and inflating it would push genuinely useful
    // findings down the feed.
    actionability: 0.15,
    goalRelevance: goalRelevanceScore("exercise", input.activeGoalDomains),
    surprise: surpriseScore(peak.avg, restAvg, restAvg),
  };
  const scored = scoreCandidate(components);

  return {
    type: "peak_month",
    grain: "lifetime",
    periodStart: `${peak.key}-01`,
    periodEnd: `${peak.key}-01`,
    facts: { month: peak.key, averageSteps: roundSteps(peak.avg), comparedTo: roundSteps(restAvg), days: peak.days },
    headline: `${formatMonth(peak.key)} was your most active month — about ${roundSteps(
      peak.avg
    ).toLocaleString()} steps a day.`,
    score: scored.score,
    dedupeKey: `peak_month:steps:${peak.key}`,
    tier: 1,
    generatorKey: "peak_month_steps",
    generatorVersion: GENERATOR_VERSION,
    scoreComponents: scored.components,
  };
}

/**
 * Weekday signature — the quietest day of the week, and by how much.
 *
 * Works on as little as a few weeks, which makes it the floor finding for
 * users with almost no history (see the graceful-floors table in the
 * plan).
 */
export function generateWeekdaySignature(input: StepPortraitInput): InsightCandidate | null {
  const byWeekday = new Map<number, number[]>();
  for (const point of input.series) {
    const dow = input.dayOfWeek.get(point.day);
    if (dow === undefined) continue;
    const bucket = byWeekday.get(dow);
    if (bucket) bucket.push(point.value);
    else byWeekday.set(dow, [point.value]);
  }

  // Every weekday needs at least three observations, or "your quietest day
  // is Tuesday" can rest on a single quiet Tuesday.
  if (byWeekday.size < 7 || [...byWeekday.values()].some((v) => v.length < 3)) return null;

  const averages = [...byWeekday.entries()].map(([dow, values]) => ({ dow, avg: mean(values), n: values.length }));
  averages.sort((a, b) => a.avg - b.avg);
  const quietest = averages[0];
  const others = averages.slice(1);
  const othersAvg = mean(others.map((d) => d.avg));
  if (othersAvg <= 0) return null;

  const gapPercent = ((othersAvg - quietest.avg) / othersAvg) * 100;
  if (gapPercent < 15) return null;

  const isWeekendDay = quietest.dow === 0 || quietest.dow === 6;
  const components = {
    effectSize: Math.min(1, gapPercent / 50),
    sampleSize: sampleSizeScore(quietest.n * 7),
    // Knowing which day collapses is directly plannable — it is the one
    // day worth moving something to.
    actionability: 0.6,
    goalRelevance: goalRelevanceScore("exercise", input.activeGoalDomains),
    // A quiet Sunday is what anyone would guess. A quiet Wednesday is not,
    // and that asymmetry is exactly what the surprise dimension is for.
    surprise: isWeekendDay ? 0.1 : Math.min(1, gapPercent / 30),
  };
  const scored = scoreCandidate(components);

  return {
    type: "weekday_signature",
    grain: "lifetime",
    periodStart: null,
    periodEnd: null,
    facts: {
      dayOfWeek: quietest.dow,
      dayName: WEEKDAY_NAMES[quietest.dow],
      averageSteps: roundSteps(quietest.avg),
      otherDaysAverage: roundSteps(othersAvg),
      gapPercent: Math.round(gapPercent),
    },
    headline: `${WEEKDAY_NAMES[quietest.dow]} is your quietest day — about ${Math.round(
      gapPercent
    )}% fewer steps than the rest of your week.`,
    score: scored.score,
    dedupeKey: `weekday_signature:steps:${new Date().toISOString().slice(0, 7)}`,
    tier: 1,
    generatorKey: "weekday_signature_steps",
    generatorVersion: GENERATOR_VERSION,
    scoreComponents: scored.components,
  };
}

/** Seasonal shape — which months you move most and least. Needs a year to
 * mean anything, so it stays silent until the backfill has earned it. */
export function generateSeasonalShape(input: StepPortraitInput): InsightCandidate | null {
  const byCalendarMonth = new Map<number, number[]>();
  for (const point of input.series) {
    const month = Number(point.day.slice(5, 7));
    const bucket = byCalendarMonth.get(month);
    if (bucket) bucket.push(point.value);
    else byCalendarMonth.set(month, [point.value]);
  }
  // Under 6 distinct calendar months there is no season to speak of, only
  // a stretch of weather.
  if (byCalendarMonth.size < 6) return null;

  const averages = [...byCalendarMonth.entries()]
    .filter(([, values]) => values.length >= 10)
    .map(([month, values]) => ({ month, avg: mean(values) }));
  if (averages.length < 6) return null;

  averages.sort((a, b) => b.avg - a.avg);
  const high = averages[0];
  const low = averages[averages.length - 1];
  const overall = mean(averages.map((m) => m.avg));
  if (overall <= 0) return null;

  const spread = ((high.avg - low.avg) / overall) * 100;
  if (spread < 20) return null;

  const components = {
    effectSize: Math.min(1, spread / 60),
    sampleSize: sampleSizeScore(averages.length * 10),
    actionability: 0.35,
    goalRelevance: goalRelevanceScore("exercise", input.activeGoalDomains),
    // Summer-high/winter-low is the null hypothesis for most of the
    // northern hemisphere; scoring it as a discovery would be dishonest.
    surprise: high.month >= 5 && high.month <= 8 && (low.month <= 2 || low.month === 12) ? 0.1 : 0.6,
  };
  const scored = scoreCandidate(components);

  return {
    type: "seasonal_shape",
    grain: "lifetime",
    periodStart: null,
    periodEnd: null,
    facts: {
      highMonth: high.month,
      highMonthName: MONTH_NAMES[high.month - 1],
      lowMonth: low.month,
      lowMonthName: MONTH_NAMES[low.month - 1],
      spreadPercent: Math.round(spread),
    },
    headline: `You move most in ${MONTH_NAMES[high.month - 1]} and least in ${
      MONTH_NAMES[low.month - 1]
    } — about ${Math.round(spread)}% apart.`,
    score: scored.score,
    dedupeKey: `seasonal_shape:steps:${new Date().getFullYear()}`,
    tier: 1,
    generatorKey: "seasonal_shape_steps",
    generatorVersion: GENERATOR_VERSION,
    scoreComponents: scored.components,
  };
}

/** Time-of-day pattern, and whether it has shifted. Reads
 * steps_most_active_local_hour, which activity_daily_summaries already
 * precomputes. */
export function generateTimeOfDayPattern(input: StepPortraitInput): InsightCandidate | null {
  const hours = input.series.map((p) => input.mostActiveHour.get(p.day)).filter((h): h is number => h !== undefined);
  if (hours.length < 21) return null;

  const half = Math.floor(hours.length / 2);
  const earlyAvg = mean(hours.slice(0, half));
  const lateAvg = mean(hours.slice(half));
  const shift = lateAvg - earlyAvg;
  if (Math.abs(shift) < 1.5) return null;

  const components = {
    effectSize: Math.min(1, Math.abs(shift) / 4),
    sampleSize: sampleSizeScore(hours.length),
    actionability: 0.5,
    goalRelevance: goalRelevanceScore("exercise", input.activeGoalDomains),
    // Baseline expectation is that a person's active hour is stable. A
    // drift of hours is a genuine change in how the day is shaped.
    surprise: Math.min(1, Math.abs(shift) / 3),
  };
  const scored = scoreCandidate(components);

  const direction = shift > 0 ? "later" : "earlier";
  return {
    type: "time_of_day_shift",
    grain: "lifetime",
    periodStart: input.series[0]?.day ?? null,
    periodEnd: input.today,
    facts: {
      earlyHour: Math.round(earlyAvg),
      lateHour: Math.round(lateAvg),
      shiftHours: Math.round(Math.abs(shift) * 10) / 10,
      direction,
    },
    headline: `Your most active hour has moved about ${
      Math.round(Math.abs(shift) * 10) / 10
    } hours ${direction} than when you started.`,
    score: scored.score,
    dedupeKey: `time_of_day_shift:steps:${new Date().toISOString().slice(0, 7)}`,
    tier: 1,
    generatorKey: "time_of_day_shift_steps",
    generatorVersion: GENERATOR_VERSION,
    scoreComponents: scored.components,
  };
}

/** Runs every Tier 0/1 generator and returns the candidates, plus the
 * changepoints themselves so the caller can persist them for annotation. */
export function generateStepPortrait(input: StepPortraitInput): {
  candidates: InsightCandidate[];
  changepoints: Changepoint[];
} {
  const changepoints = detectChangepoints(input.series);
  const candidates = [
    generateChangepointInsight(input, changepoints),
    generatePeakMonth(input),
    generateWeekdaySignature(input),
    generateSeasonalShape(input),
    generateTimeOfDayPattern(input),
  ].filter((c): c is InsightCandidate => c !== null);

  return { candidates, changepoints };
}

export { normalizeDailySeries };
