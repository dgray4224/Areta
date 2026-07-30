import type {
  OnboardingOutput,
  OnboardingResponses,
  OnboardingStepKey,
  PhaseDraft,
  WeeklyOutcomeDraft,
  PersonalizationProfileDraft,
} from "@/domains/onboarding/types";
import type { DomainKey, Goal } from "@/domains/goals/schema";

/** The onboarding sequence is per-user: Nutrition/Recovery/Learning only
 * appear when the user actually picked that area as a goal category, so a
 * user with e.g. only a Family goal never sees the Nutrition questionnaire.
 * V1 is health-only (see domains/goals/schema.ts V1_DOMAIN_KEYS) — picking
 * "health" unconditionally unlocks Nutrition/Exercise/Sleep. The individual
 * domain checks stay alongside `wantsHealth` (not replaced by it) so a
 * future phase reintroducing fine-grained pillar chips needs no changes
 * here. */
export function effectiveSteps(goals: Goal[]): OnboardingStepKey[] {
  const domains = new Set(goals.map((g) => g.domainKey));
  const wantsHealth = domains.has("health");
  const steps: OnboardingStepKey[] = ["identity", "goals"];
  if (wantsHealth || domains.has("nutrition")) steps.push("nutrition");
  if (wantsHealth || domains.has("exercise")) steps.push("exercise");
  if (wantsHealth || domains.has("sleep")) steps.push("sleep");
  if (domains.has("recovery")) steps.push("recovery");
  if (domains.has("learning")) steps.push("learning");
  steps.push("coaching");
  return steps;
}

/** Progress-bar position and "Back" target for a step page, computed from
 * the user's current effective sequence rather than a fixed order. */
export function stepPosition(
  step: OnboardingStepKey,
  goals: Goal[]
): { stepIndex: number; totalSteps: number; backHref: string | undefined } {
  const steps = effectiveSteps(goals);
  const idx = steps.indexOf(step);
  return {
    stepIndex: idx + 1,
    totalSteps: steps.length + 1, // +1 for the review screen
    backHref: idx > 0 ? `/onboarding/${steps[idx - 1]}` : undefined,
  };
}

export function firstIncompleteStep(responses: OnboardingResponses): OnboardingStepKey | null {
  const steps = effectiveSteps(responses.goals);
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
    if (goal.domainKey === "health") {
      // V1's single bundled "Health" goal fans out into its constituent
      // pillars here so nutrition/exercise's parameter engines (which look
      // up a `domains` row by specific key, e.g. "nutrition") keep working
      // unchanged — see write-output.ts for the corresponding goal->domain
      // link resolution.
      domains.add("nutrition");
      domains.add("exercise");
      domains.add("sleep");
    } else {
      domains.add(goal.domainKey);
    }
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
