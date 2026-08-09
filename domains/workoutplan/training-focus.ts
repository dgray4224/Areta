import type { WorkoutPlanItemView } from "@/domains/workoutplan/service";
import type { Exercise } from "@/domains/exerciselibrary/types";

export type TrainingFocusLabel = "Heavy lifting week" | "Heavy cardio week" | "Balanced week" | "Recovery week";

export type WeeklyTrainingFocus = {
  label: TrainingFocusLabel | null;
  resistanceMinutes: number;
  aerobicMinutes: number;
  mobilityMinutes: number;
  /** Items whose exercise carries no modality (pre-migration-0044 legacy
   * items, or a since-deleted exercise) -- excluded from the weighting
   * below rather than guessed at, so this stays a known, reportable gap
   * (see domains/exercise/schema.ts's modality doc comment) instead of
   * silently skewing the classification. */
  unclassifiedCount: number;
};

// Rough per-set time-under-tension-plus-rest estimate for a resistance/
// power set, and a fallback duration for aerobic/mobility items that
// somehow have no duration_minutes recorded -- both exist purely to put
// "sets" and "minutes" on the same comparable axis (estimated minutes of
// training time), never surfaced to the user directly.
const MINUTES_PER_RESISTANCE_SET = 2;
const DEFAULT_AEROBIC_MINUTES = 20;
const DEFAULT_MOBILITY_MINUTES = 10;

// A week only reads as "Recovery" when mobility clearly dominates, and
// "Heavy lifting/cardio" only when one side clearly outweighs the other
// -- anything closer than these margins reads as "Balanced" rather than
// picking a side on a coin-flip.
const RECOVERY_MOBILITY_SHARE = 0.6;
const HEAVY_SHARE_MARGIN = 0.25;

/**
 * Classifies a week's training emphasis from its workout_plan_items,
 * joined to each exercise's modality (resistance/aerobic/mobility/power).
 * Distinct from phase_focus/phaseFocus, which describes an entire
 * multi-week training phase's stated goal -- this describes what this
 * specific week's actual planned exercise mix looks like, for the
 * Calendar summary card (Plan-tab-overhaul Phase C).
 */
export function classifyWeeklyTrainingFocus(
  items: WorkoutPlanItemView[],
  exercises: Map<string, Exercise>
): WeeklyTrainingFocus {
  let resistanceMinutes = 0;
  let aerobicMinutes = 0;
  let mobilityMinutes = 0;
  let unclassifiedCount = 0;

  for (const item of items) {
    const modality = exercises.get(item.exerciseId)?.modality ?? null;
    switch (modality) {
      case "resistance":
      case "power":
        resistanceMinutes += (item.sets ?? 1) * MINUTES_PER_RESISTANCE_SET;
        break;
      case "aerobic":
        aerobicMinutes += item.durationMinutes ?? DEFAULT_AEROBIC_MINUTES;
        break;
      case "mobility":
        mobilityMinutes += item.durationMinutes ?? DEFAULT_MOBILITY_MINUTES;
        break;
      default:
        unclassifiedCount++;
    }
  }

  const totalMinutes = resistanceMinutes + aerobicMinutes + mobilityMinutes;
  if (totalMinutes === 0) {
    return { label: null, resistanceMinutes, aerobicMinutes, mobilityMinutes, unclassifiedCount };
  }

  const mobilityShare = mobilityMinutes / totalMinutes;
  if (mobilityShare >= RECOVERY_MOBILITY_SHARE) {
    return { label: "Recovery week", resistanceMinutes, aerobicMinutes, mobilityMinutes, unclassifiedCount };
  }

  const resistanceShare = resistanceMinutes / totalMinutes;
  const aerobicShare = aerobicMinutes / totalMinutes;
  let label: TrainingFocusLabel = "Balanced week";
  if (resistanceShare - aerobicShare >= HEAVY_SHARE_MARGIN) {
    label = "Heavy lifting week";
  } else if (aerobicShare - resistanceShare >= HEAVY_SHARE_MARGIN) {
    label = "Heavy cardio week";
  }

  return { label, resistanceMinutes, aerobicMinutes, mobilityMinutes, unclassifiedCount };
}
