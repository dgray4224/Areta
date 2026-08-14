import { z } from "zod";

/** Curated training archetypes — retained only for the old
 * archetype/program/rotation pipeline (domains/workoutplan/rotation.ts,
 * domains/parameters/exercise-calc.ts, domains/trainingprogram/*) and
 * the unrelated ad-hoc exercise-log feature below. The Exercise
 * onboarding step itself no longer uses these — see EXERCISE_GOALS —
 * this list retires alongside that old pipeline once the goal-first
 * recommendation engine replaces it. */
export const EXERCISE_ARCHETYPES = [
  "long_distance_runner",
  "powerlifter",
  "hybrid_athlete",
  "general_fitness",
  "hypertrophy",
  "triathlete",
  "cyclist",
  "olympic_weightlifter",
  "functional_fitness",
] as const;
export type ExerciseArchetype = (typeof EXERCISE_ARCHETYPES)[number];

export const EXERCISE_ARCHETYPE_LABELS: Record<ExerciseArchetype, string> = {
  long_distance_runner: "Long-distance runner",
  powerlifter: "Powerlifter / strength-focused",
  hybrid_athlete: "Hybrid athlete (strength + endurance)",
  general_fitness: "General fitness / health",
  hypertrophy: "Muscle building / hypertrophy",
  triathlete: "Triathlete (swim/bike/run)",
  cyclist: "Cyclist (road/gravel/track)",
  olympic_weightlifter: "Olympic weightlifter (snatch, clean & jerk)",
  functional_fitness: "Functional fitness / mixed-modal competitor",
};

export const EXPERIENCE_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

/** Suggested chip options for equipment access — a starting point the user
 * can add to, not an exhaustive list. Also what the workout-plan generator
 * (domains/workoutplan/generate.ts) filters the exercise library against. */
export const EQUIPMENT_SUGGESTIONS = [
  "Barbell",
  "Dumbbells",
  "Kettlebells",
  "Resistance bands",
  "Pull-up bar",
  "Cable machine",
  "Cardio machine",
  "Full gym access",
  "Bodyweight only",
];

// ============================================================
// New goal-first Exercise onboarding (7 core questions + 1
// goal-conditional question). Replaces the old archetype-first
// exerciseSchema below it in git history -- see domains/exercise/legacy.ts
// for the old shape (kept alive only so already-onboarded users can be
// detected and prompted to redo onboarding in this new shape).
// ============================================================

export const EXERCISE_GOALS = [
  "lose_fat",
  "build_muscle",
  "get_stronger",
  "improve_endurance",
  "improve_general_fitness",
  "move_and_feel_better",
  "train_for_event",
] as const;
export type ExerciseGoal = (typeof EXERCISE_GOALS)[number];

export const EXERCISE_GOAL_LABELS: Record<ExerciseGoal, string> = {
  lose_fat: "Lose body fat",
  build_muscle: "Build muscle",
  get_stronger: "Get stronger",
  improve_endurance: "Improve endurance",
  improve_general_fitness: "Improve general fitness",
  move_and_feel_better: "Move and feel better",
  train_for_event: "Train for an event",
};

export const RECENT_EXPERIENCE_LEVELS = ["new_or_returning", "occasional", "consistent", "highly_experienced"] as const;
export type RecentExperienceLevel = (typeof RECENT_EXPERIENCE_LEVELS)[number];

export const RECENT_EXPERIENCE_LABELS: Record<RecentExperienceLevel, string> = {
  new_or_returning: "New, or returning after a long break",
  occasional: "Exercise occasionally",
  consistent: "Exercise consistently",
  highly_experienced: "Highly experienced",
};

export const DAYS_PER_WEEK_OPTIONS = ["1", "2", "3", "4", "5_plus"] as const;
export type DaysPerWeekOption = (typeof DAYS_PER_WEEK_OPTIONS)[number];

export const SESSION_DURATION_BANDS = ["15_20", "30", "45", "60_plus"] as const;
export type SessionDurationBand = (typeof SESSION_DURATION_BANDS)[number];

export const SESSION_DURATION_LABELS: Record<SessionDurationBand, string> = {
  "15_20": "15-20 minutes",
  "30": "30 minutes",
  "45": "45 minutes",
  "60_plus": "60+ minutes",
};

/** Mirrors program_templates.equipment_context exactly (Phase 0
 * migration) so a user's answer maps directly to template selection
 * with no translation layer. */
export const TRAINING_LOCATIONS = [
  "home_no_equipment",
  "home_basic_equipment",
  "full_gym",
  "outdoors",
  "combination",
] as const;
export type TrainingLocation = (typeof TRAINING_LOCATIONS)[number];

export const TRAINING_LOCATION_LABELS: Record<TrainingLocation, string> = {
  home_no_equipment: "Home, without equipment",
  home_basic_equipment: "Home, with basic equipment",
  full_gym: "Full gym",
  outdoors: "Outdoors",
  combination: "A combination",
};

export const PREFERRED_ACTIVITIES = [
  "strength_training",
  "walking",
  "running",
  "cycling",
  "swimming",
  "mobility_or_yoga",
  "interval_training",
  "choose_for_me",
] as const;
export type PreferredActivity = (typeof PREFERRED_ACTIVITIES)[number];

export const PREFERRED_ACTIVITY_LABELS: Record<PreferredActivity, string> = {
  strength_training: "Strength training",
  walking: "Walking",
  running: "Running",
  cycling: "Cycling",
  swimming: "Swimming",
  mobility_or_yoga: "Mobility or yoga",
  interval_training: "Interval training",
  choose_for_me: "Choose for me",
};

export const INJURY_STATUS_OPTIONS = ["no", "yes", "unsure"] as const;
export type InjuryStatus = (typeof INJURY_STATUS_OPTIONS)[number];

/** Fixed vocabulary the recommendation engine's limitation_rules table
 * (Phase 0 migration) matches against -- structured tags, not prose, so
 * exclusion/substitution rules are reliably matchable. Areta never
 * diagnoses; this is a triage classification the user picks themselves. */
export const LIMITATION_TAGS = [
  "lower_back",
  "knee",
  "shoulder",
  "hip",
  "wrist_or_elbow",
  "ankle_or_foot",
  "neck",
  "cardiovascular",
  "pregnancy_or_postpartum",
  "other",
] as const;
export type LimitationTag = (typeof LIMITATION_TAGS)[number];

export const LIMITATION_TAG_LABELS: Record<LimitationTag, string> = {
  lower_back: "Lower back",
  knee: "Knee",
  shoulder: "Shoulder",
  hip: "Hip",
  wrist_or_elbow: "Wrist or elbow",
  ankle_or_foot: "Ankle or foot",
  neck: "Neck",
  cardiovascular: "Cardiovascular condition",
  pregnancy_or_postpartum: "Pregnancy or postpartum",
  other: "Other",
};

/** Red-flag symptoms that trigger a hard-stop professional-clearance
 * message in the UI rather than proceeding with onboarding -- Areta
 * must never diagnose or prescribe rehab (CLAUDE.md-equivalent rule
 * carried over from the Recovery domain's existing doc comment). This
 * list is UI-facing content the onboarding screen checks against; it's
 * exported here so both the web and mobile forms show the identical
 * wording and trigger condition. */
export const PROFESSIONAL_CLEARANCE_RED_FLAGS = [
  "Chest pain, pressure, or shortness of breath during exercise",
  "Numbness, tingling, or loss of function",
  "Surgery in the last 6 weeks",
  "A fracture, dislocation, or sprain that hasn't been evaluated",
] as const;

const goalDetailSchema = z
  .object({
    // lose_fat
    desiredFatLossChange: z.string().optional(),
    noSpecificFatLossAmount: z.boolean().optional(),
    // build_muscle
    muscleGainFocus: z.enum(["balanced", "prioritized_areas"]).optional(),
    prioritizedMuscleAreas: z.array(z.string()).optional(),
    // get_stronger
    prioritizedMovements: z.array(z.string()).optional(),
    // improve_endurance
    preferredEnduranceActivity: z.string().optional(),
    // train_for_event
    eventType: z.string().optional(),
    eventDistance: z.string().optional(),
    eventDate: z.string().optional(),
    // improve_general_fitness / move_and_feel_better
    wellbeingFocusAreas: z.array(z.string()).optional(),
  })
  .optional();

export const exerciseSchema = z
  .object({
    // Q1
    primaryGoal: z.enum(EXERCISE_GOALS).optional(),
    // Q2
    recentExperience: z.enum(RECENT_EXPERIENCE_LEVELS).optional(),
    // Q3
    daysPerWeek: z.enum(DAYS_PER_WEEK_OPTIONS).optional(),
    // Q4
    sessionDurationBand: z.enum(SESSION_DURATION_BANDS).optional(),
    // Q5
    trainingLocation: z.enum(TRAINING_LOCATIONS).optional(),
    equipmentAccess: z.array(z.string()).optional(),
    // Q6
    preferredActivities: z.array(z.enum(PREFERRED_ACTIVITIES)).optional(),
    dislikedActivities: z.array(z.string()).optional(),
    // Q7 -- lightweight triage; real clinical detail lives in the
    // Recovery domain, gated on via domains/onboarding/transform.ts
    // when injuryStatus !== "no".
    injuryStatus: z.enum(INJURY_STATUS_OPTIONS).optional(),
    affectedArea: z.string().optional(),
    prohibitedMovements: z.string().optional(),
    clinicianRestrictions: z.string().optional(),
    limitationTags: z.array(z.enum(LIMITATION_TAGS)).optional(),
    redFlagsAcknowledged: z.boolean().optional(),
    // Q8 -- conditional on primaryGoal, validated below
    goalDetail: goalDetailSchema,
  })
  .superRefine((data, ctx) => {
    if (!data.primaryGoal || !data.goalDetail) return;
    const detail = data.goalDetail;
    switch (data.primaryGoal) {
      case "build_muscle":
        if (detail.muscleGainFocus === "prioritized_areas" && !detail.prioritizedMuscleAreas?.length) {
          ctx.addIssue({
            code: "custom",
            path: ["goalDetail", "prioritizedMuscleAreas"],
            message: "List which areas you'd like to prioritize.",
          });
        }
        break;
      case "train_for_event":
        if (!detail.eventType) {
          ctx.addIssue({ code: "custom", path: ["goalDetail", "eventType"], message: "What's the event?" });
        }
        break;
      default:
        break;
    }
  });

export type ExerciseInput = z.infer<typeof exerciseSchema>;

export const exerciseLogSchema = z.object({
  date: z.string().min(1, "Date is required"),
  archetype: z.enum(EXERCISE_ARCHETYPES).optional(),
  durationMinutes: z.number().int().min(0).optional(),
  perceivedExertion: z.number().int().min(1).max(10).optional(),
  notes: z.string().optional(),
});

export type ExerciseLogInput = z.infer<typeof exerciseLogSchema>;
