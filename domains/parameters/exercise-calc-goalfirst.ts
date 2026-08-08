import type { ExerciseGoal, ExerciseInput } from "@/domains/exercise/schema";
import type { GeneratedParameter } from "@/domains/parameters/types";
import { DAYS_PER_WEEK_VALUE, EXPERIENCE_TO_TIER } from "@/domains/recommendation/types";

/**
 * Goal-first successor to calculateExerciseParameters (exercise-calc.ts,
 * which stays for legacy-shape users). Same six output parameter ids, so
 * the whole downstream approve/edit flow (ParametersForm,
 * approveGeneratedParameters, generateAndSaveWorkoutPlan's
 * sessions_per_week read) needs zero changes. Pure and side-effect free.
 *
 * Ranges/prose ground in the migration 0090 claims: RP volume landmarks
 * (build_muscle), ACSM progression models (get_stronger,
 * novice_full_body_frequency), ACSM aerobic dose (lose_fat,
 * general fitness), Seiler 80/20 + Daniels (endurance/event), and the
 * ~10%/week progression cap + every-4th-week deload defaults shared
 * with the legacy calculator.
 */

const GOAL_SESSION_RANGE: Record<ExerciseGoal, { min: number; max: number }> = {
  lose_fat: { min: 3, max: 5 },
  build_muscle: { min: 3, max: 6 },
  get_stronger: { min: 3, max: 5 },
  improve_endurance: { min: 3, max: 6 },
  improve_general_fitness: { min: 2, max: 4 },
  move_and_feel_better: { min: 2, max: 4 },
  train_for_event: { min: 3, max: 6 },
};

const GOAL_PRIMARY_FOCUS: Record<ExerciseGoal, string> = {
  lose_fat: "Full-body resistance work to hold onto muscle while losing fat, plus enough weekly aerobic work to meet health guidelines.",
  build_muscle: "Progressive weekly set volume across every major muscle group, using moderate rep ranges taken close to failure.",
  get_stronger: "Heavy multi-joint lifts at low reps with full rest, progressed conservatively via the 2-for-2 rule.",
  improve_endurance: "Mostly-easy aerobic volume anchored by a weekly long session, with a small deliberate dose of quality work (the 80/20 principle).",
  improve_general_fitness: "Balanced full-body strength plus regular aerobic work, meeting public-health activity guidelines.",
  move_and_feel_better: "Gentle, sustainable movement — easy aerobic work and comfortable strength patterns, always sub-maximal.",
  train_for_event: "An easy-dominant aerobic base building toward your event, sharpened with event-specific quality work.",
};

/** Goals where a true novice should ease in below typical volume —
 * mirrors the legacy AGGRESSIVE_ARCHETYPES + beginner gate. */
const DEMANDING_GOALS: ExerciseGoal[] = ["build_muscle", "get_stronger", "train_for_event"];

const PHASE_LENGTH_WEEKS = 8; // matches the 4+4-week template phases seeded by the blueprint generator
const DELOAD_FREQUENCY_WEEKS = 4;
const WEEKLY_PROGRESSION_CAP_PCT = 10;

export type GoalFirstExerciseParameterResult = {
  parameters: GeneratedParameter[];
  missingInputs: string[];
};

export function calculateGoalFirstExerciseParameters(exercise: ExerciseInput): GoalFirstExerciseParameterResult {
  const missingInputs: string[] = [];
  if (!exercise.primaryGoal) missingInputs.push("your primary training goal");
  if (!exercise.primaryGoal) return { parameters: [], missingInputs };

  const goal = exercise.primaryGoal;
  const range = GOAL_SESSION_RANGE[goal];
  const assumptions: string[] = [];
  const safetyBounds: string[] = [];

  const tier = exercise.recentExperience ? EXPERIENCE_TO_TIER[exercise.recentExperience] : "beginner";
  if (!exercise.recentExperience) {
    assumptions.push('Training experience not provided — assumed "beginner" (the more conservative default).');
  }

  const statedDays = exercise.daysPerWeek ? DAYS_PER_WEEK_VALUE[exercise.daysPerWeek] : null;
  const sessionsPerWeek = statedDays !== null
    ? Math.min(Math.max(statedDays, range.min), range.max)
    : Math.round((range.min + range.max) / 2);
  if (statedDays === null) {
    assumptions.push(`Days/week not provided — assumed the middle of the typical range for this goal (${range.min}-${range.max}).`);
  } else if (statedDays < range.min) {
    safetyBounds.push(
      `You asked for ${statedDays} day${statedDays === 1 ? "" : "s"}/week — this goal typically needs at least ${range.min} to progress, so the plan schedules ${range.min}.`
    );
  }

  let requiresProfessionalApproval = false;
  if (tier === "beginner" && DEMANDING_GOALS.includes(goal)) {
    safetyBounds.push(
      "Starting as a beginner toward a demanding goal — the first phase deliberately stays below typical volume, and a coach for form/load guidance is worth considering."
    );
    requiresProfessionalApproval = true;
  }
  if (exercise.injuryStatus && exercise.injuryStatus !== "no") {
    safetyBounds.push(
      "You flagged an injury or limitation — exercises matching it are excluded or substituted automatically, but anything a clinician restricted stays their call, not this plan's."
    );
  }

  const reviewDate = new Date();
  reviewDate.setDate(reviewDate.getDate() + PHASE_LENGTH_WEEKS * 7);
  const reviewDateIso = reviewDate.toISOString().slice(0, 10);

  const confidence = missingInputs.length === 0 ? 0.8 : Math.max(0.8 - missingInputs.length * 0.15, 0.4);

  const base = {
    domain: "exercise",
    source: "rule" as const,
    assumptions,
    confidence,
    safetyBounds: safetyBounds.length > 0 ? safetyBounds : undefined,
    reviewDate: reviewDateIso,
    requiresUserApproval: true,
    requiresProfessionalApproval: requiresProfessionalApproval || undefined,
  };

  const goalLabel = goal.replace(/_/g, " ");
  const parameters: GeneratedParameter[] = [
    {
      ...base,
      id: "sessions_per_week",
      name: "Sessions per week",
      value: sessionsPerWeek,
      unit: "sessions/week",
      range,
      rationale: `Typical range for a ${goalLabel} goal is ${range.min}-${range.max} sessions/week, matched to your stated availability.`,
    },
    {
      ...base,
      id: "phase_structure",
      name: "Phase structure",
      value: "Base → Build",
      rationale: "Two 4-week blocks: a base block establishing volume and technique, then a build block progressing it — after which the plan reselects fresh programming.",
    },
    {
      ...base,
      id: "phase_length_weeks",
      name: "Phase length",
      value: PHASE_LENGTH_WEEKS,
      unit: "weeks",
      rationale: "Two 4-week template phases per programming cycle — long enough to adapt, short enough to reassess.",
    },
    {
      ...base,
      id: "weekly_progression_cap_pct",
      name: "Weekly progression cap",
      value: WEEKLY_PROGRESSION_CAP_PCT,
      unit: "%/week",
      rationale: "A widely-used injury-prevention guideline for increasing volume or mileage week over week.",
    },
    {
      ...base,
      id: "deload_frequency_weeks",
      name: "Deload frequency",
      value: DELOAD_FREQUENCY_WEEKS,
      unit: "weeks",
      rationale: "The final week of each 4-week phase is a reduced-volume deload — progress toward maximum adaptive volume, then recover before the next block.",
    },
    {
      ...base,
      id: "primary_focus",
      name: "Primary focus",
      value: GOAL_PRIMARY_FOCUS[goal],
      rationale: `What this training cycle emphasizes for a ${goalLabel} goal.`,
    },
  ];

  return { parameters, missingInputs };
}
