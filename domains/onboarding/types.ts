import type { IdentityInput } from "@/domains/identity/schema";
import type { Goal, DomainKey } from "@/domains/goals/schema";

export type { DomainKey };
import type { NutritionInput } from "@/domains/nutrition/schema";
import type { RecoveryInput } from "@/domains/recovery/schema";
import type { ExerciseInput } from "@/domains/exercise/schema";
import type { LearningInput } from "@/domains/learning/schema";
import type { CoachingInput } from "@/domains/coaching/schema";

/** Sleep and Coaching are deliberately not onboarding steps — see
 * effectiveSteps in transform.ts for why. */
export type OnboardingStepKey =
  | "identity"
  | "goals"
  | "nutrition"
  | "exercise"
  | "recovery"
  | "learning";

export type OnboardingResponses = {
  userId: string;
  identity: IdentityInput | null;
  goals: Goal[];
  nutrition: NutritionInput | null;
  exercise: ExerciseInput | null;
  recovery: RecoveryInput | null;
  learning: LearningInput | null;
  completedSteps: OnboardingStepKey[];
};

export type RankedGoal = Goal & { id?: string };

export type PhaseDraft = {
  name: string;
  mission: string;
  goalOutcome: string;
};

export type WeeklyOutcomeDraft = {
  goalOutcome: string;
  outcomeText: string;
};

export type PersonalizationProfileDraft = {
  tone: CoachingInput["tone"];
  planningStyle: CoachingInput["planningStyle"];
  reminderPreference: CoachingInput["reminderPreference"];
  explanationDepth: CoachingInput["explanationDepth"];
  rescheduleMissedTasks: CoachingInput["rescheduleMissedTasks"];
  neverRecommend: string[];
};

/** The Phase 1 "Onboarding output" (CLAUDE.md Phase 1) — fully editable
 * before the user confirms it, per the spec's "Generate editable" wording. */
export type OnboardingOutput = {
  mission: string;
  activeDomains: DomainKey[];
  rankedGoals: RankedGoal[];
  currentPhases: PhaseDraft[];
  initialWeeklyOutcomes: WeeklyOutcomeDraft[];
  dailyCheckinFields: string[];
  knownConstraints: string[];
  initialPersonalizationProfile: PersonalizationProfileDraft;
};
