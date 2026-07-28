import type {
  OnboardingOutput,
  OnboardingResponses,
  OnboardingStepKey,
  PhaseDraft,
  WeeklyOutcomeDraft,
  PersonalizationProfileDraft,
} from "@/domains/onboarding/types";
import { ONBOARDING_STEPS } from "@/domains/onboarding/types";
import type { DomainKey } from "@/domains/goals/schema";

export function firstIncompleteStep(
  completedSteps: OnboardingStepKey[]
): OnboardingStepKey | null {
  return ONBOARDING_STEPS.find((step) => !completedSteps.includes(step)) ?? null;
}

/**
 * Pure, deterministic transform from raw onboarding answers to the
 * structured "Onboarding output" (CLAUDE.md Phase 1). No I/O — this is the
 * critical logic CLAUDE.md rule 6/17 asks to keep deterministic and tested,
 * since it's what turns free-text goals into the platform's ranked
 * goals/phases/weekly-outcomes records.
 */
export function transformOnboarding(responses: OnboardingResponses): OnboardingOutput {
  const { identity, goals, recovery, coaching } = responses;

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

  const knownConstraints = deriveKnownConstraints(goals, recovery);

  const initialPersonalizationProfile: PersonalizationProfileDraft = {
    tone: coaching?.tone ?? "gentle",
    planningStyle: coaching?.planningStyle ?? "flexible",
    reminderPreference: coaching?.reminderPreference ?? "minimal",
    explanationDepth: coaching?.explanationDepth ?? "brief",
    rescheduleMissedTasks: coaching?.rescheduleMissedTasks ?? true,
    neverRecommend: coaching?.neverRecommend ?? [],
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
  recovery: OnboardingResponses["recovery"]
): DomainKey[] {
  const domains = new Set<DomainKey>();
  for (const goal of goals) {
    domains.add(goal.domainKey);
  }
  if (recovery && !recovery.skipped) {
    domains.add("recovery");
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
  recovery: OnboardingResponses["recovery"]
): string[] {
  const constraints: string[] = [];
  for (const goal of goals) {
    if (goal.constraints) {
      constraints.push(goal.constraints);
    }
  }
  if (recovery && !recovery.skipped && recovery.restrictions) {
    constraints.push(recovery.restrictions);
  }
  return constraints;
}
