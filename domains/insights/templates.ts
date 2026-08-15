/** Deterministic headline templates for the insight detectors (Insight
 * Engine v2, 2026-08-14). Every number in a headline comes straight from
 * the detector's computed facts — no LLM anywhere in this path, per the
 * Social Insight Engine concept doc's "never manufacture an insight"
 * principle (the weekly-brief LLM narrates these separately; see Phase 3).
 *
 * Each type has a couple of phrasing variants so repeated insight types
 * don't read copy-pasted; the variant is picked deterministically from the
 * dedupe key (stable per insight, varied across insights) via hashSeed.
 * Markdown-lite (**bold**) only — both web and mobile render it through
 * their existing RichText components. */

import { hashSeed } from "./stats";
import { weekdayName } from "./dates";
import type { FactSeries } from "./types";

/** Display eyebrow per detector type -- the server-side source of truth
 * (added via /code-review, 2026-08-14): mobile's InsightFeed.tsx
 * previously hardcoded its own copy of this mapping with no shared
 * contract, so a new or renamed detector type would silently degrade to
 * a generic "Insight" label until a mobile release caught up. Now
 * included in the /api/insights response as `typeLabel`, so the
 * client's local mirror only has to serve as a same-version convenience
 * / offline fallback rather than the source of truth. Keep this in sync
 * with any new detector added to domains/insights/detectors/. */
export const TYPE_LABELS: Record<string, string> = {
  personal_record: "Personal record",
  behavior_streak: "Streak",
  sleep_next_day_completion: "Pattern",
  weekday_pattern: "Pattern",
  workout_timing_sleep: "Pattern",
  weekend_shift: "Pattern",
};

export function typeLabelFor(type: string): string {
  return TYPE_LABELS[type] ?? "Insight";
}

function pick(variants: string[], dedupeKey: string): string {
  return variants[hashSeed(dedupeKey) % variants.length];
}

/** How long a milestone took to accumulate, in the coarsest honest unit.
 * The point of a milestone card is the SPAN, not the count — "100
 * workouts" is a usage counter, "100 workouts across 17 months" is
 * perseverance. Returns null below ~2 weeks, where the span isn't the
 * impressive part and saying it out loud would undercut the number. */
function accumulationSpan(series: FactSeries | null | undefined): string | null {
  if (!series || series.kind !== "accumulation") return null;
  const from = new Date(`${series.firstDay}T00:00:00Z`);
  const to = new Date(`${series.lastDay}T00:00:00Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;

  const months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (months >= 24) {
    const years = Math.floor(months / 12);
    return `${years} years`;
  }
  if (months >= 2) return `${months} months`;

  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000);
  if (days >= 14) return `${Math.round(days / 7)} weeks`;
  return null;
}

function hoursLabel(minutes: number): string {
  const hours = minutes / 60;
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : `${rounded}`;
}

export function sleepNextDayCompletionHeadline(
  facts: { thresholdMinutes: number; goodAvgCompletion: number; shortAvgCompletion: number },
  dedupeKey: string
): string {
  const threshold = hoursLabel(facts.thresholdMinutes);
  return pick(
    [
      `After nights of **${threshold}+ hours** of sleep you complete **${facts.goodAvgCompletion}%** of your tasks — after shorter nights, **${facts.shortAvgCompletion}%**.`,
      `Sleep is doing more than you think: **${facts.goodAvgCompletion}%** of tasks done after **${threshold}+ hour** nights, **${facts.shortAvgCompletion}%** after short ones.`,
    ],
    dedupeKey
  );
}

export function weekdayPatternHeadline(
  facts: { dayOfWeek: number; weekdayAvg: number; othersAvg: number; direction: string },
  dedupeKey: string
): string {
  const name = weekdayName(facts.dayOfWeek);
  if (facts.direction === "worse") {
    return pick(
      [
        `You have a **${name} problem**: **${facts.weekdayAvg}%** of tasks get done on ${name}s, vs **${facts.othersAvg}%** every other day.`,
        `${name}s are your hardest day — task completion drops to **${facts.weekdayAvg}%**, against **${facts.othersAvg}%** the rest of the week.`,
      ],
      dedupeKey
    );
  }
  return pick(
    [
      `**${name}s are your day**: **${facts.weekdayAvg}%** of tasks completed, vs **${facts.othersAvg}%** every other day.`,
      `Something about ${name}s works for you — **${facts.weekdayAvg}%** task completion, against **${facts.othersAvg}%** the rest of the week.`,
    ],
    dedupeKey
  );
}

export function workoutTimingSleepHeadline(
  facts: { morningAvgSleep: number; eveningAvgSleep: number; effectMinutes: number; betterBucket: string },
  dedupeKey: string
): string {
  const better = facts.betterBucket === "morning" ? "morning" : "evening";
  const other = better === "morning" ? "evening" : "morning";
  return pick(
    [
      `On days you train in the **${better}**, you sleep **${facts.effectMinutes} minutes longer** that night than on ${other}-workout days.`,
      `Your body prefers **${better} workouts**: they're followed by **${facts.effectMinutes} more minutes** of sleep than ${other} sessions.`,
    ],
    dedupeKey
  );
}

export function weekendShiftHeadline(
  facts: { metric: string; weekendAvg: number; weekdayAvg: number; effect: number },
  dedupeKey: string
): string {
  if (facts.metric === "sleep") {
    const direction = facts.weekendAvg > facts.weekdayAvg ? "more" : "less";
    return pick(
      [
        `Weekend you is different: **${Math.abs(facts.effect)} minutes ${direction} sleep** than on weekdays.`,
        `Your weekends run on a different clock — **${Math.abs(facts.effect)} minutes ${direction} sleep** than the workweek.`,
      ],
      dedupeKey
    );
  }
  const direction = facts.weekendAvg > facts.weekdayAvg ? "more" : "fewer";
  return pick(
    [
      `Weekend you is different: **${Math.abs(facts.effect).toLocaleString("en-US")} ${direction} steps** a day than on weekdays.`,
      `Your weekends move differently — **${Math.abs(facts.effect).toLocaleString("en-US")} ${direction} steps** a day than the workweek.`,
    ],
    dedupeKey
  );
}

export function personalRecordHeadline(
  facts: {
    kind: string;
    value: number;
    day?: string | null;
    milestone?: number | null;
    series?: FactSeries | null;
  },
  dedupeKey: string
): string {
  switch (facts.kind) {
    case "steps_day":
      return pick(
        [
          `New record: **${facts.value.toLocaleString("en-US")} steps** in a single day — your most ever.`,
          `You just out-walked every day before it: **${facts.value.toLocaleString("en-US")} steps**, a personal best.`,
        ],
        dedupeKey
      );
    case "workout_minutes_day":
      return pick(
        [
          `Longest training day yet: **${facts.value} minutes** of workouts.`,
          `New personal best — **${facts.value} minutes** of training in one day.`,
        ],
        dedupeKey
      );
    // Milestone headlines lead with the time span rather than the app
    // ("logged with Areta" made the achievement about product usage
    // instead of the person). Insights written before series data
    // existed have no span available and fall back to the count alone.
    case "workout_milestone": {
      const span = accumulationSpan(facts.series);
      const count = facts.milestone ?? 0;
      return span
        ? pick(
            [
              `**${count} workouts** across ${span}.`,
              `${span} of showing up — **${count} workouts** deep.`,
            ],
            dedupeKey
          )
        : pick(
            [
              `**${count} workouts** in. That's sustained effort.`,
              `Milestone: **${count} workouts** behind you.`,
            ],
            dedupeKey
          );
    }
    case "steps_milestone": {
      const span = accumulationSpan(facts.series);
      const steps = (facts.milestone ?? 0).toLocaleString("en-US");
      return span
        ? pick(
            [
              `**${steps} steps** across ${span}. One day at a time.`,
              `${span} of moving — **${steps} steps** and counting.`,
            ],
            dedupeKey
          )
        : pick(
            [
              `**${steps} steps** walked. Every one of them yours.`,
              `Milestone: **${steps} total steps**.`,
            ],
            dedupeKey
          );
    }
    default:
      return `New personal record.`;
  }
}

export function behaviorStreakHeadline(
  facts: { kind: string; length: number },
  dedupeKey: string
): string {
  if (facts.kind === "steps_above_median") {
    return pick(
      [
        `**${facts.length} days straight** above your own typical step count. Momentum is real.`,
        `You've beaten your usual step count **${facts.length} days in a row**.`,
      ],
      dedupeKey
    );
  }
  return pick(
    [
      `**${facts.length} consecutive weeks** with multiple workouts. That's a habit now.`,
      `${facts.length} weeks running, you've trained more than once a week — consistency looks good on you.`,
    ],
    dedupeKey
  );
}
