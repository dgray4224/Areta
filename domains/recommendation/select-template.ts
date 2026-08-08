import type { ExerciseInput } from "@/domains/exercise/schema";
import {
  DAYS_PER_WEEK_VALUE,
  EXPERIENCE_TO_TIER,
  type ExperienceTier,
  type ProgramTemplate,
} from "@/domains/recommendation/types";

/** Same deterministic djb2-style hash as workoutplan/rotation.ts —
 * stable tie-breaks instead of Math.random(), so regenerating before
 * saving is idempotent. */
export function stableHash(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export type SelectTemplateInput = {
  userId: string;
  exercise: ExerciseInput;
  templates: ProgramTemplate[];
  /** Template ids this user has already completed — down-ranked (not
   * excluded) so a long-time user rotates variety. */
  usedTemplateIds?: string[];
};

export type SelectTemplateResult = {
  template: ProgramTemplate | null;
  tier: ExperienceTier;
  warnings: string[];
};

const BAND_ORDER = ["15_20", "30", "45", "60_plus"] as const;

/**
 * Picks the best-matching template for the user's goal-first onboarding
 * answers. The goal is a hard filter; every other axis (tier, equipment
 * context, duration band, days/week) is scored so the nearest template
 * always wins deterministically — a user whose exact combo wasn't
 * authored (or who trains in a "combination" of locations) still gets
 * the closest real template, with a warning naming what was relaxed.
 */
export function selectTemplate(input: SelectTemplateInput): SelectTemplateResult {
  const warnings: string[] = [];
  const tier: ExperienceTier = input.exercise.recentExperience
    ? EXPERIENCE_TO_TIER[input.exercise.recentExperience]
    : "beginner";
  if (!input.exercise.recentExperience) {
    warnings.push('Training experience not provided — assumed "beginner" (the more conservative default).');
  }

  const goal = input.exercise.primaryGoal;
  if (!goal) return { template: null, tier, warnings };

  const candidates = input.templates.filter((t) => t.goal === goal);
  if (candidates.length === 0) {
    warnings.push("No authored templates exist for this goal.");
    return { template: null, tier, warnings };
  }

  const tierIndex: Record<ExperienceTier, number> = { beginner: 0, intermediate: 1, advanced: 2 };
  const days = input.exercise.daysPerWeek ? DAYS_PER_WEEK_VALUE[input.exercise.daysPerWeek] : null;
  const location = input.exercise.trainingLocation;
  const band = input.exercise.sessionDurationBand;
  const used = new Set(input.usedTemplateIds ?? []);

  let best: { template: ProgramTemplate; score: number } | null = null;
  for (const t of candidates) {
    let score = 0;

    const tierDistance = Math.abs(tierIndex[t.experienceTier] - tierIndex[tier]);
    score += tierDistance === 0 ? 100 : tierDistance === 1 ? 40 : 0;

    if (!location || location === "combination") {
      // Mixed-location users match any context; prefer the richer ones.
      score += t.equipmentContext === "full_gym" ? 35 : t.equipmentContext === "home_basic_equipment" ? 30 : 20;
    } else if (t.equipmentContext === location) {
      score += 60;
    } else {
      // Degrade toward less-equipped contexts rather than more-equipped:
      // recommending a full-gym template to a no-equipment user is
      // worse than the reverse.
      const degradesTo: Record<string, string[]> = {
        full_gym: ["home_basic_equipment", "home_no_equipment"],
        home_basic_equipment: ["home_no_equipment"],
        home_no_equipment: [],
        outdoors: ["home_no_equipment"],
      };
      score += (degradesTo[location] ?? []).includes(t.equipmentContext) ? 25 : 5;
    }

    if (band) {
      const bandDistance = Math.abs(BAND_ORDER.indexOf(t.sessionDurationBand) - BAND_ORDER.indexOf(band));
      score += bandDistance === 0 ? 40 : bandDistance === 1 ? 20 : 0;
    } else {
      score += t.sessionDurationBand === "45" ? 20 : 10; // no answer -> prefer the middle band
    }

    if (days !== null) {
      if (days >= t.daysPerWeekMin && days <= t.daysPerWeekMax) score += 30;
      else score += Math.max(0, 30 - 15 * Math.min(days < t.daysPerWeekMin ? t.daysPerWeekMin - days : days - t.daysPerWeekMax, 2));
    }

    if (used.has(t.id)) score -= 25;

    // Deterministic jitter (0-9) breaks exact ties stably per user.
    score += stableHash(`${input.userId}:${t.slug}`) % 10;

    if (!best || score > best.score) best = { template: t, score };
  }

  const chosen = best!.template;
  if (location && location !== "combination" && chosen.equipmentContext !== location) {
    warnings.push(
      `No ${goal.replace(/_/g, " ")} template matched your training location exactly — using the closest match (${chosen.equipmentContext.replace(/_/g, " ")}).`
    );
  }
  if (chosen.experienceTier !== tier) {
    warnings.push(`Matched to the ${chosen.experienceTier} version — the closest available to your experience level.`);
  }
  if (band && chosen.sessionDurationBand !== band) {
    warnings.push("Matched to the closest available session length.");
  }
  if (days !== null && (days < chosen.daysPerWeekMin || days > chosen.daysPerWeekMax)) {
    warnings.push(
      `This template is designed for ${chosen.daysPerWeekMin}-${chosen.daysPerWeekMax} days/week — sessions will be cycled to fit your ${days}-day week.`
    );
  }

  return { template: chosen, tier, warnings };
}
