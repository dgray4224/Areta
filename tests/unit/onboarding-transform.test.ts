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

  it("includes recovery in active domains and check-in fields when not skipped", () => {
    const output = transformOnboarding(founderResponses);
    expect(output.activeDomains).toContain("recovery");
    expect(output.dailyCheckinFields).toContain("recovery");
  });

  it("excludes recovery from active domains and check-in fields when skipped", () => {
    const skippedResponses: OnboardingResponses = {
      ...founderResponses,
      recovery: { skipped: true },
      goals: founderResponses.goals.filter((g) => g.domainKey !== "recovery"),
    };
    const output = transformOnboarding(skippedResponses);
    expect(output.activeDomains).not.toContain("recovery");
    expect(output.dailyCheckinFields).not.toContain("recovery");
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
    expect(output.activeDomains).toHaveLength(0);
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
  it("includes nutrition, recovery, and learning when goals exist in those domains", () => {
    expect(effectiveSteps(founderGoals)).toEqual([
      "identity",
      "goals",
      "nutrition",
      "recovery",
      "learning",
    ]);
  });

  it("omits domain-specific steps entirely when no goal targets them", () => {
    const nonModuleGoals = founderGoals.map((g) => ({ ...g, domainKey: "family" as const }));
    expect(effectiveSteps(nonModuleGoals)).toEqual(["identity", "goals"]);
  });

  it("includes only the domain-specific steps that apply", () => {
    const mixedGoals = [
      { ...founderGoals[0], domainKey: "nutrition" as const },
      { ...founderGoals[1], domainKey: "family" as const },
    ];
    expect(effectiveSteps(mixedGoals)).toEqual(["identity", "goals", "nutrition"]);
  });

  it("a single 'health' goal unlocks nutrition and exercise as onboarding steps (V1 bundling); sleep stays a tracked domain without a step", () => {
    const healthGoal = [{ ...founderGoals[0], domainKey: "health" as const }];
    expect(effectiveSteps(healthGoal)).toEqual(["identity", "goals", "nutrition", "exercise"]);
  });
});

describe("stepPosition", () => {
  it("computes stepIndex/totalSteps/backHref from the effective sequence", () => {
    expect(stepPosition("nutrition", founderGoals)).toEqual({
      stepIndex: 3,
      totalSteps: 6,
      backHref: "/onboarding/goals",
    });
    expect(stepPosition("learning", founderGoals)).toEqual({
      stepIndex: 5,
      totalSteps: 6,
      backHref: "/onboarding/recovery",
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

  it("skips domain-specific steps that don't apply to the user's goals", () => {
    const nonModuleResponses: OnboardingResponses = {
      ...founderResponses,
      goals: founderGoals.map((g) => ({ ...g, domainKey: "family" as const })),
      completedSteps: ["identity"],
    };
    expect(firstIncompleteStep(nonModuleResponses)).toBe("goals");
    expect(
      firstIncompleteStep({ ...nonModuleResponses, completedSteps: ["identity", "goals"] })
    ).toBeNull();
  });
});
