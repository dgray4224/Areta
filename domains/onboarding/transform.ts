import type {
  OnboardingOutput,
  OnboardingResponses,
  OnboardingStepKey,
  PhaseDraft,
  WeeklyOutcomeDraft,
  PersonalizationProfileDraft,
} from "@/domains/onboarding/types";
import type { DomainKey, Goal } from "@/domains/goals/schema";
import type { ExerciseInput } from "@/domains/exercise/schema";

/** The onboarding sequence, consolidated (2026-08-07) to only the steps
 * whose answers actually drive nutrition/workout recommendations:
 * Identity -> Goals (skippable) -> Nutrition -> Exercise -> Review.
 *
 * - Nutrition/Exercise no longer gate on picking a "Health" goal — V1 is
 *   health-only anyway, so the gate only created a way to accidentally
 *   skip the two steps the plan generators depend on. Goals itself
 *   became skippable in the same pass (a trainer signing up to coach,
 *   not to be coached, has no personal goal to state).
 * - Recovery was dropped as a step: every field except `restrictions`
 *   was write-only, and the Exercise step's own injury triage
 *   (injuryStatus/limitationTags/prohibitedMovements/
 *   clinicianRestrictions) is what the recommendation engine actually
 *   consumes. The recovery schema/service/API stay dormant for old data.
 * - Learning was dropped: unreachable in V1 (no "learning" goal chip
 *   exists) and every field was write-only.
 *
 * Sleep and Coaching are deliberately never onboarding steps: Sleep's
 * target bedtime/wake are already covered by Identity's wake/bedtime
 * fields (everything else sleep-related is asked contextually later, see
 * domains/prompts), and Coaching lives in Settings -> Personalization,
 * defaulted rather than asked. */
export function effectiveSteps(_goals: Goal[], _exercise?: ExerciseInput | null): OnboardingStepKey[] {
  return ["identity", "goals", "nutrition", "exercise"];
}

/** Progress-bar position and "Back" target for a step page, computed from
 * the user's current effective sequence rather than a fixed order. */
export function stepPosition(
  step: OnboardingStepKey,
  goals: Goal[],
  exercise?: ExerciseInput | null
): { stepIndex: number; totalSteps: number; backHref: string | undefined } {
  const steps = effectiveSteps(goals, exercise);
  const idx = steps.indexOf(step);
  return {
    stepIndex: idx + 1,
    totalSteps: steps.length + 1, // +1 for the review screen
    backHref: idx > 0 ? `/onboarding/${steps[idx - 1]}` : undefined,
  };
}

export function firstIncompleteStep(responses: OnboardingResponses): OnboardingStepKey | null {
  const steps = effectiveSteps(responses.goals, responses.exercise);
  return steps.find((step) => !responses.completedSteps.includes(step)) ?? null;
}

/**
 * Pure, deterministic transform from raw onboarding answers to the
 * structured "Onboarding output" (CLAUDE.md Phase 1). No I/O — this is the
 * critical logic CLAUDE.md rule 6/17 asks to keep deterministic and tested,
 * since it's what turns free-text goals into the platform's ranked
 * goals/phases/weekly-outcomes records.
 */
export function transformOnboarding(responses: OnboardingResponses): OnboardingOutput {
  const { identity, goals, recovery, exercise } = responses;

  const activeDomains = deriveActiveDomains(goals, recovery);
  const rankedGoals = rankGoals(goals);
  const topGoal = rankedGoals[0];
  const displayName = identity?.fullName?.trim() || "you";

  const mission = topGoal
    ? `Help ${displayName} ${topGoal.outcome}${topGoal.targetDate ? ` by ${topGoal.targetDate}` : ""}.`
    : `Help ${displayName} build a working weekly operating system.`;

  const currentPhases: PhaseDraft[] = rankedGoals.map((goal) => ({
    name: `${goal.domainKey} phase`,
    mission: goal.outcome,
    goalOutcome: goal.outcome,
  }));

  const initialWeeklyOutcomes: WeeklyOutcomeDraft[] = rankedGoals.map((goal) => ({
    goalOutcome: goal.outcome,
    outcomeText: `Take the first concrete step toward: ${goal.outcome}`,
  }));

  const dailyCheckinFields = deriveDailyCheckinFields(activeDomains);

  const knownConstraints = deriveKnownConstraints(goals, recovery, exercise);

  // Coaching preferences are no longer an onboarding step (see
  // effectiveSteps) — these defaults are what every account starts with,
  // editable anytime afterward in Settings -> Personalization.
  const initialPersonalizationProfile: PersonalizationProfileDraft = {
    tone: "gentle",
    planningStyle: "flexible",
    reminderPreference: "minimal",
    explanationDepth: "brief",
    rescheduleMissedTasks: true,
    neverRecommend: [],
  };

  return {
    mission,
    activeDomains,
    rankedGoals,
    currentPhases,
    initialWeeklyOutcomes,
    dailyCheckinFields,
    knownConstraints,
    initialPersonalizationProfile,
  };
}

function deriveActiveDomains(
  goals: OnboardingResponses["goals"],
  _recovery: OnboardingResponses["recovery"]
): DomainKey[] {
  // V1's health pillars are always active — the Nutrition/Exercise steps
  // are always part of onboarding now (see effectiveSteps), so their
  // parameter engines (which look up a `domains` row by specific key,
  // e.g. "nutrition") must find one even for a user who skipped Goals.
  const domains = new Set<DomainKey>(["nutrition", "exercise", "sleep"]);
  for (const goal of goals) {
    if (goal.domainKey !== "health") domains.add(goal.domainKey);
  }
  return Array.from(domains);
}

function rankGoals(goals: OnboardingResponses["goals"]) {
  return [...goals].sort((a, b) => a.priority - b.priority || b.confidence - a.confidence);
}

function deriveDailyCheckinFields(activeDomains: DomainKey[]): string[] {
  const fields = new Set<string>(["sleep"]);
  if (activeDomains.includes("nutrition")) {
    fields.add("weight");
    fields.add("nutrition");
  }
  if (activeDomains.includes("exercise")) {
    fields.add("exercise");
  }
  if (activeDomains.includes("recovery")) {
    fields.add("recovery");
  }
  if (activeDomains.includes("learning")) {
    fields.add("learning");
  }
  return Array.from(fields);
}

function deriveKnownConstraints(
  goals: OnboardingResponses["goals"],
  recovery: OnboardingResponses["recovery"],
  exercise?: OnboardingResponses["exercise"]
): string[] {
  const constraints: string[] = [];
  for (const goal of goals) {
    if (goal.constraints) {
      constraints.push(goal.constraints);
    }
  }
  // The Exercise step's injury triage is the clinical-detail home now
  // that Recovery is no longer a step; old accounts' recovery
  // restrictions still count.
  if (exercise?.clinicianRestrictions) constraints.push(exercise.clinicianRestrictions);
  if (exercise?.prohibitedMovements) constraints.push(exercise.prohibitedMovements);
  if (recovery && !recovery.skipped && recovery.restrictions) {
    constraints.push(recovery.restrictions);
  }
  return constraints;
}
