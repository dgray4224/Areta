/**
 * The founder's development seed profile (CLAUDE.md §17). Deliberately
 * lives only here, under `supabase/seed/`, and is consumed only by
 * `scripts/seed.ts` — never imported by anything under `app/`, `platform/`,
 * or `domains/`, so none of these specifics leak into platform logic.
 */
import { identitySchema, type IdentityInput } from "@/domains/identity/schema";
import type { Goal } from "@/domains/goals/schema";
import { nutritionSchema, type NutritionInput } from "@/domains/nutrition/schema";
import { recoverySchema, type RecoveryInput } from "@/domains/recovery/schema";
import { learningSchema, type LearningInput } from "@/domains/learning/schema";
import { coachingSchema, type CoachingInput } from "@/domains/coaching/schema";
import type { OnboardingStepKey } from "@/domains/onboarding/types";

export const FOUNDER_EMAIL = "founder+dev@lifeos.local";
export const FOUNDER_PASSWORD = "lifeos-dev-seed-only-not-for-real-use";

export const founderIdentity: IdentityInput = identitySchema.parse({
  fullName: "Founder",
  timeZone: "America/New_York",
  units: "imperial",
  wakeTime: "06:30",
  bedTime: "22:30",
  workStatus: "Remote, full-time during recovery",
  workHoursNote: "Standard business hours, flexible around PT appointments",
  schoolCommitments: "Fall semester off; OMSA begins early January",
  weeklyReviewDay: 0,
  groceryDay: 6,
  mealPrepDay: 0,
  learningTimeMinutesPerWeek: 300,
} satisfies IdentityInput);

export const founderGoals: Goal[] = [
  {
    domainKey: "recovery",
    outcome: "Return to jogging after patellar tendon repair",
    why: "Regain full function and get back to running",
    targetDate: "",
    startingState: "Early post-surgical recovery (surgery 2026-07-29)",
    constraints: "Follow clinician-approved progression only",
    successCriteria: "Cleared by care team to resume running",
    priority: 1,
    confidence: 3,
    knownObstacles: "Timeline depends entirely on clinician sign-off",
  },
  {
    domainKey: "nutrition",
    outcome: "Weigh 200 pounds",
    why: "Support recovery and long-term health",
    targetDate: "2027-02-01",
    startingState: "Approximately 220 pounds",
    constraints: "Reduced activity while recovering",
    successCriteria: "Seven-day average at or under 200 lbs",
    priority: 2,
    confidence: 3,
    knownObstacles: "Lower activity level during early recovery",
  },
  {
    domainKey: "learning",
    outcome: "Become employable as an AI solutions engineer",
    why: "Career transition into AI/data engineering",
    targetDate: "2027-06-01",
    startingState: "Existing software background, new to applied AI",
    constraints: "OMSA coursework begins early January",
    successCriteria: "Portfolio of production AI projects plus OMSA progress",
    priority: 3,
    confidence: 3,
    knownObstacles: "Balancing recovery, remote work, and coursework",
  },
];

export const founderNutrition: NutritionInput = nutritionSchema.parse({
  height: 69, // 5'9"
  currentWeight: 220,
  targetWeight: 200,
  favoriteMeals: ["Breakfast"],
  groceryStores: ["Costco"],
  cookingAbility: "intermediate",
  trackingPreference: "simple",
  proteinTargetGrams: 170,
  mealsPerDay: 3,
} satisfies NutritionInput);

export const founderRecovery: RecoveryInput = recoverySchema.parse({
  skipped: false,
  injuryOrSurgeryDate: "2026-07-29",
  currentPhase: "Early post-operative",
  clinicianInstructions: "Follow surgeon and physical therapist guidance exactly",
  restrictions: "Weight-bearing and range-of-motion limits per clinician",
  physicalTherapySchedule: "Per clinic schedule",
  trackPainAndSwelling: true,
  warningSignsAcknowledged: true,
} satisfies RecoveryInput);

export const founderLearning: LearningInput = learningSchema.parse({
  careerDirection: ["AI solutions engineering"],
  currentSkills: ["Software development"],
  desiredSkills: ["AI engineering", "Microsoft Fabric", "data engineering", "production AI apps"],
  preferredFormat: "project",
  weeklyAvailableHours: 5,
  formalCoursePlans: "OMSA begins early January",
} satisfies LearningInput);

export const founderCoaching: CoachingInput = coachingSchema.parse({
  tone: "direct",
  planningStyle: "flexible",
  reminderPreference: "minimal",
  explanationDepth: "detailed",
  rescheduleMissedTasks: true,
  neverRecommend: [],
} satisfies CoachingInput);

export const founderCompletedSteps: OnboardingStepKey[] = [
  "identity",
  "goals",
  "nutrition",
  "recovery",
  "learning",
  "coaching",
];
