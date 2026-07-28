import { describe, expect, it } from "vitest";
import { transformOnboarding, firstIncompleteStep } from "@/domains/onboarding/transform";
import { ONBOARDING_STEPS } from "@/domains/onboarding/types";
import type { OnboardingResponses } from "@/domains/onboarding/types";
import {
  founderIdentity,
  founderGoals,
  founderNutrition,
  founderRecovery,
  founderLearning,
  founderCoaching,
} from "@/supabase/seed/dev-seed";

const founderResponses: OnboardingResponses = {
  userId: "test-user",
  identity: founderIdentity,
  goals: founderGoals,
  nutrition: founderNutrition,
  recovery: founderRecovery,
  learning: founderLearning,
  coaching: founderCoaching,
  completedSteps: ONBOARDING_STEPS,
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
      recovery: null,
      learning: null,
      coaching: null,
      completedSteps: [],
    };
    const output = transformOnboarding(minimalResponses);
    expect(output.mission).toContain("Alex");
    expect(output.rankedGoals).toHaveLength(0);
    expect(output.activeDomains).toHaveLength(0);
  });

  it("applies personalization defaults when coaching answers are missing", () => {
    const minimalResponses: OnboardingResponses = {
      userId: "minimal-user",
      identity: founderIdentity,
      goals: [],
      nutrition: null,
      recovery: null,
      learning: null,
      coaching: null,
      completedSteps: [],
    };
    const output = transformOnboarding(minimalResponses);
    expect(output.initialPersonalizationProfile.tone).toBe("gentle");
    expect(output.initialPersonalizationProfile.planningStyle).toBe("flexible");
  });
});

describe("firstIncompleteStep", () => {
  it("returns the first step not yet completed", () => {
    expect(firstIncompleteStep([])).toBe("identity");
    expect(firstIncompleteStep(["identity"])).toBe("goals");
  });

  it("returns null once every step is complete", () => {
    expect(firstIncompleteStep(ONBOARDING_STEPS)).toBeNull();
  });
});
