import { DOMAIN_LABELS, type DomainKey } from "@/domains/goals/schema";
import type { MemoryType } from "@/domains/memory/schema";

const SLEEP_FLOOR_MINUTES = 6 * 60;
const MISSED_TASK_THRESHOLD = 3;
/** Below this many logged nights in the lookback window, there isn't
 * enough data to trust an average — stay quiet rather than guess. */
const MIN_SLEEP_SAMPLES = 3;

export type TriggerInput = {
  today: string;
  activeGoals: { domainKey: string; targetDate: string | null }[];
  activeDomains: string[];
  hasRecentExerciseLog: boolean;
  recentSleepDurationsMinutes: number[];
  sleepTargetMinutes?: number;
  skippedRequiredTaskCountByDomain: Record<string, number>;
};

export type PromptTrigger = {
  id: string;
  /** Fixed per trigger regardless of which internal condition fired —
   * doesn't depend on the evaluate() result. */
  memoryType: MemoryType;
  /** Returns the question to show when this trigger fires, or null when it
   * doesn't. A function (not a fixed string) so triggers like
   * missed_tasks_pattern can interpolate which domain fired. */
  evaluate: (input: TriggerInput) => string | null;
};

/**
 * Fixed, deterministic trigger catalog (CLAUDE.md rule 6 — code, not AI,
 * decides when to ask). Evaluated in priority order by
 * domains/prompts/service.ts's getActivePrompt, which returns at most one
 * firing trigger. Answers become Durable Memory rows (CLAUDE.md §7 Layer 4)
 * instead of a static weekly questionnaire.
 */
export const PROMPT_TRIGGERS: PromptTrigger[] = [
  {
    id: "exercise_goal_stalled",
    memoryType: "failed_strategy",
    evaluate: (input) => {
      const stalled = input.activeGoals.some(
        (g) => g.domainKey === "exercise" && !input.hasRecentExerciseLog
      );
      return stalled ? "Still working toward this, or has something changed?" : null;
    },
  },
  {
    id: "goal_target_passed",
    memoryType: "motivation",
    evaluate: (input) => {
      const passed = input.activeGoals.some(
        (g) => g.targetDate !== null && g.targetDate < input.today
      );
      return passed ? "Did you hit this, or should Areta help set up what's next?" : null;
    },
  },
  {
    id: "sleep_below_norm",
    memoryType: "constraint",
    evaluate: (input) => {
      if (!input.activeDomains.includes("sleep")) return null;
      if (input.recentSleepDurationsMinutes.length < MIN_SLEEP_SAMPLES) return null;
      const floor = input.sleepTargetMinutes ?? SLEEP_FLOOR_MINUTES;
      const avg =
        input.recentSleepDurationsMinutes.reduce((sum, m) => sum + m, 0) /
        input.recentSleepDurationsMinutes.length;
      return avg < floor ? "Anything affecting your sleep lately?" : null;
    },
  },
  {
    id: "missed_tasks_pattern",
    memoryType: "failed_strategy",
    evaluate: (input) => {
      const entry = Object.entries(input.skippedRequiredTaskCountByDomain).find(
        ([, count]) => count >= MISSED_TASK_THRESHOLD
      );
      if (!entry) return null;
      const [domainKey] = entry;
      const label = DOMAIN_LABELS[domainKey as DomainKey] ?? domainKey;
      return `What's getting in the way of ${label}?`;
    },
  },
];
