import { describe, expect, it } from "vitest";
import {
  transformOnboarding,
  firstIncompleteStep,
  effectiveSteps,
  stepPosition,
} from "@/domains/onboarding/transform";
import type { OnboardingResponses, OnboardingStepKey } from "@/domains/onboarding/types";
import {
  founderIdentity,
  founderGoals,
  founderNutrition,
  founderRecovery,
  founderLearning,
} from "@/supabase/seed/dev-seed";

const founderCompletedSteps: OnboardingStepKey[] = effectiveSteps(founderGoals);

const founderResponses: OnboardingResponses = {
  userId: "test-user",
  identity: founderIdentity,
  goals: founderGoals,
  nutrition: founderNutrition,
  exercise: null,
  recovery: founderRecovery,
  learning: founderLearning,
  completedSteps: founderCompletedSteps,
};

describe("transformOnboarding", () => {
  it("derives a mission from the top-priority goal", () => {
    const output = transformOnboarding(founderResponses);
    expect(output.mission).toContain("Founder");
    expect(output.mission).toContain(founderResponses.goals[0].outcome);
  });

  it("ranks goals by priority ascending", () => {
    const output = transformOnboarding(founderResponses);
    expect(output.rankedGoals[0].outcome).toBe(
      "Return to jogging after patellar tendon repair"
    );
    expect(output.rankedGoals.map((g) => g.priority)).toEqual([1, 2, 3]);
  });

  it("still surfaces a recovery goal as an active domain (recovery is no longer its own step)", () => {
    const output = transformOnboarding(founderResponses);
    // founderResponses includes a recovery-domain goal, which flows
    // through as a domain even though the Recovery step was cut in the
    // 2026-08-07 consolidation.
    expect(output.activeDomains).toContain("recovery");
    expect(output.dailyCheckinFields).toContain("recovery");
  });

  it("expands a single 'health' goal into nutrition/exercise/sleep active domains for downstream tracking (not an onboarding step)", () => {
    const healthResponses: OnboardingResponses = {
      ...founderResponses,
      goals: [{ ...founderGoals[0], domainKey: "health" as const }],
      recovery: null,
    };
    const output = transformOnboarding(healthResponses);
    expect(output.activeDomains).toEqual(
      expect.arrayContaining(["nutrition", "exercise", "sleep"])
    );
    expect(output.dailyCheckinFields).toEqual(expect.arrayContaining(["exercise", "sleep"]));
  });

  it("carries goal constraints and recovery restrictions into known constraints", () => {
    const output = transformOnboarding(founderResponses);
    expect(output.knownConstraints.length).toBeGreaterThan(0);
    expect(output.knownConstraints).toContain(founderResponses.recovery?.restrictions);
  });

  it("falls back to a generic mission and empty derived lists with no goals", () => {
    const minimalResponses: OnboardingResponses = {
      userId: "minimal-user",
      identity: { ...founderIdentity, fullName: "Alex" },
      goals: [],
      nutrition: null,
      exercise: null,
      recovery: null,
      learning: null,
      completedSteps: [],
    };
    const output = transformOnboarding(minimalResponses);
    expect(output.mission).toContain("Alex");
    expect(output.rankedGoals).toHaveLength(0);
    // V1 health pillars are always active even with no goals -- the
    // Nutrition/Exercise steps always run, so their parameter engines
    // must find their domains rows (2026-08-07 consolidation).
    expect(output.activeDomains).toEqual(expect.arrayContaining(["nutrition", "exercise", "sleep"]));
  });

  it("always applies personalization defaults, since coaching is no longer an onboarding step", () => {
    const minimalResponses: OnboardingResponses = {
      userId: "minimal-user",
      identity: founderIdentity,
      goals: [],
      nutrition: null,
      exercise: null,
      recovery: null,
      learning: null,
      completedSteps: [],
    };
    const output = transformOnboarding(minimalResponses);
    expect(output.initialPersonalizationProfile.tone).toBe("gentle");
    expect(output.initialPersonalizationProfile.planningStyle).toBe("flexible");
  });
});

describe("effectiveSteps", () => {
  it("is the fixed consolidated sequence regardless of goals (2026-08-07)", () => {
    expect(effectiveSteps(founderGoals)).toEqual(["identity", "goals", "nutrition", "exercise"]);
    expect(effectiveSteps([])).toEqual(["identity", "goals", "nutrition", "exercise"]);
  });

  it("no longer gates a Recovery step on injury triage -- the Exercise step owns injury detail now", () => {
    expect(effectiveSteps(founderGoals, { injuryStatus: "yes" })).not.toContain("recovery");
    expect(effectiveSteps(founderGoals, { injuryStatus: "unsure" })).not.toContain("recovery");
  });

  it("never includes the removed learning step", () => {
    expect(effectiveSteps(founderGoals)).not.toContain("learning");
  });
});

describe("stepPosition", () => {
  it("computes stepIndex/totalSteps/backHref from the effective sequence", () => {
    expect(stepPosition("nutrition", founderGoals)).toEqual({
      stepIndex: 3,
      totalSteps: 5, // 4 steps + review
      backHref: "/onboarding/goals",
    });
    expect(stepPosition("exercise", founderGoals)).toEqual({
      stepIndex: 4,
      totalSteps: 5,
      backHref: "/onboarding/nutrition",
    });
  });

  it("has no backHref for the first step", () => {
    expect(stepPosition("identity", founderGoals).backHref).toBeUndefined();
  });
});

describe("firstIncompleteStep", () => {
  it("returns the first step not yet completed", () => {
    expect(firstIncompleteStep({ ...founderResponses, completedSteps: [] })).toBe("identity");
    expect(firstIncompleteStep({ ...founderResponses, completedSteps: ["identity"] })).toBe(
      "goals"
    );
  });

  it("returns null once every effective step is complete", () => {
    expect(firstIncompleteStep(founderResponses)).toBeNull();
  });

  it("always requires nutrition and exercise regardless of goal domains (2026-08-07)", () => {
    const nonModuleResponses: OnboardingResponses = {
      ...founderResponses,
      goals: founderGoals.map((g) => ({ ...g, domainKey: "family" as const })),
      completedSteps: ["identity"],
    };
    expect(firstIncompleteStep(nonModuleResponses)).toBe("goals");
    expect(
      firstIncompleteStep({ ...nonModuleResponses, completedSteps: ["identity", "goals"] })
    ).toBe("nutrition");
  });
});
