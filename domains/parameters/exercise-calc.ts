import type { ExerciseArchetype, ExperienceLevel } from "@/domains/exercise/schema";
import type { GeneratedParameter } from "@/domains/parameters/types";

/** Sessions/week range per archetype — well-established, generic training
 * volume guidance (not tied to any single named coach's methodology). */
const ARCHETYPE_SESSION_RANGE: Record<ExerciseArchetype, { min: number; max: number }> = {
  long_distance_runner: { min: 3, max: 6 },
  powerlifter: { min: 3, max: 5 },
  hybrid_athlete: { min: 4, max: 6 },
  general_fitness: { min: 2, max: 4 },
  hypertrophy: { min: 3, max: 6 },
  triathlete: { min: 5, max: 7 },
  cyclist: { min: 3, max: 6 },
  olympic_weightlifter: { min: 3, max: 5 },
  functional_fitness: { min: 3, max: 6 },
};

const ARCHETYPE_PRIMARY_FOCUS: Record<ExerciseArchetype, string> = {
  long_distance_runner: "Aerobic base building with a weekly long run and mostly easy-pace mileage.",
  powerlifter: "Squat/bench/deadlift strength with structured accessory volume.",
  hybrid_athlete: "Concurrent strength and endurance work, sequenced to minimize interference between them.",
  general_fitness: "Balanced full-body strength and cardio for general health.",
  hypertrophy: "Progressive volume overload across major muscle groups.",
  triathlete: "Balanced swim/bike/run volume building toward race-specific endurance, with brick sessions tying disciplines together.",
  cyclist: "Aerobic base and threshold-building on the bike, supported by cycling-specific strength work.",
  olympic_weightlifter: "Technical proficiency in the snatch and clean & jerk, built on top of foundational strength.",
  functional_fitness: "Varied high-intensity strength, gymnastics, and conditioning work across broad time domains.",
};

/** Archetypes aggressive enough that a true beginner should ease in
 * conservatively rather than jump straight to the archetype's typical
 * volume (mirrors nutrition's calorie-floor safety-bound pattern). */
const AGGRESSIVE_ARCHETYPES: ExerciseArchetype[] = [
  "powerlifter",
  "hybrid_athlete",
  "olympic_weightlifter",
  "functional_fitness",
];

const DEFAULT_PHASE_LENGTH_WEEKS = 8;
const MIN_PHASE_LENGTH_WEEKS = 4;
const MAX_PHASE_LENGTH_WEEKS = 16;
const DELOAD_FREQUENCY_WEEKS = 4;
const WEEKLY_PROGRESSION_CAP_PCT = 10;

export type ExerciseParameterInputs = {
  archetype?: ExerciseArchetype;
  experienceLevel?: ExperienceLevel;
  trainingPhaseLengthWeeks?: number;
  daysPerWeekAvailable?: number;
  sessionLengthMinutesAvailable?: number;
};

export type ExerciseParameterResult = {
  parameters: GeneratedParameter[];
  missingInputs: string[];
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Deterministic Outcome-to-Operating-Parameters engine for exercise
 * (CLAUDE.md §5A), mirroring domains/parameters/nutrition-calc.ts. Produces
 * *structural* training parameters (sessions/week, phase length, focus) —
 * not a day-by-day workout plan, which domains/workoutplan/generate.ts
 * builds from these once approved. Pure and side-effect free.
 */
export function calculateExerciseParameters(
  inputs: ExerciseParameterInputs
): ExerciseParameterResult {
  const missingInputs: string[] = [];
  if (!inputs.archetype) missingInputs.push("what type of exerciser you want to be");

  if (!inputs.archetype) {
    return { parameters: [], missingInputs };
  }

  const archetype = inputs.archetype;
  const range = ARCHETYPE_SESSION_RANGE[archetype];
  const assumptions: string[] = [];

  const experienceLevel = inputs.experienceLevel ?? "beginner";
  if (!inputs.experienceLevel) {
    assumptions.push('Experience level not provided — assumed "beginner" (the more conservative default).');
  }

  const sessionsPerWeek = inputs.daysPerWeekAvailable
    ? clamp(inputs.daysPerWeekAvailable, range.min, range.max)
    : Math.round((range.min + range.max) / 2);
  if (!inputs.daysPerWeekAvailable) {
    assumptions.push(`Days/week not provided — assumed the middle of the typical range for this archetype (${range.min}-${range.max}).`);
  }

  let phaseLengthWeeks = inputs.trainingPhaseLengthWeeks ?? DEFAULT_PHASE_LENGTH_WEEKS;
  if (!inputs.trainingPhaseLengthWeeks) {
    assumptions.push(`Phase length not provided — assumed a moderate ${DEFAULT_PHASE_LENGTH_WEEKS}-week phase.`);
  }
  const safetyBounds: string[] = [];
  if (phaseLengthWeeks < MIN_PHASE_LENGTH_WEEKS || phaseLengthWeeks > MAX_PHASE_LENGTH_WEEKS) {
    const capped = clamp(phaseLengthWeeks, MIN_PHASE_LENGTH_WEEKS, MAX_PHASE_LENGTH_WEEKS);
    safetyBounds.push(
      `Requested phase length (${phaseLengthWeeks} weeks) is outside the typical ${MIN_PHASE_LENGTH_WEEKS}-${MAX_PHASE_LENGTH_WEEKS} week range — capped at ${capped}.`
    );
    phaseLengthWeeks = capped;
  }

  let requiresProfessionalApproval = false;
  if (experienceLevel === "beginner" && AGGRESSIVE_ARCHETYPES.includes(archetype)) {
    safetyBounds.push(
      "Starting as a beginner in a high-demand archetype — ease in below the archetype's typical volume for the first phase, and consider a trainer for form/load guidance."
    );
    requiresProfessionalApproval = true;
  }

  const reviewDate = new Date();
  reviewDate.setDate(reviewDate.getDate() + phaseLengthWeeks * 7);
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

  const parameters: GeneratedParameter[] = [
    {
      ...base,
      id: "sessions_per_week",
      name: "Sessions per week",
      value: sessionsPerWeek,
      unit: "sessions/week",
      range,
      rationale: `Typical range for ${archetype.replace(/_/g, " ")} is ${range.min}-${range.max} sessions/week, matched to your stated availability.`,
    },
    {
      ...base,
      id: "phase_structure",
      name: "Phase structure",
      value: "Base → Build → Peak",
      rationale: "Standard periodization framing: a base-building block, a build block raising intensity, then a peak block before reassessing.",
    },
    {
      ...base,
      id: "phase_length_weeks",
      name: "Phase length",
      value: phaseLengthWeeks,
      unit: "weeks",
      rationale: "Your stated training phase length, clamped to a typical safe range.",
    },
    {
      ...base,
      id: "weekly_progression_cap_pct",
      name: "Weekly progression cap",
      value: WEEKLY_PROGRESSION_CAP_PCT,
      unit: "%/week",
      rationale: "A widely-used injury-prevention guideline for increasing volume or mileage week over week — most directly relevant for running-heavy archetypes.",
    },
    {
      ...base,
      id: "deload_frequency_weeks",
      name: "Deload frequency",
      value: DELOAD_FREQUENCY_WEEKS,
      unit: "weeks",
      rationale: "A reduced-volume recovery week every 4th week is a common, conservative default across periodization models.",
    },
    {
      ...base,
      id: "primary_focus",
      name: "Primary focus",
      value: ARCHETYPE_PRIMARY_FOCUS[archetype],
      rationale: `What this phase emphasizes for a ${archetype.replace(/_/g, " ")} goal.`,
    },
  ];

  return { parameters, missingInputs };
}
