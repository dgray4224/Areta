import { describe, expect, it } from "vitest";
import { selectTemplate } from "@/domains/recommendation/select-template";
import type { ProgramTemplate } from "@/domains/recommendation/types";
import type { ExerciseInput } from "@/domains/exercise/schema";

let templateCounter = 0;
function template(overrides: Partial<ProgramTemplate>): ProgramTemplate {
  templateCounter++;
  return {
    id: `t${templateCounter}`,
    slug: `slug-${templateCounter}`,
    name: `Template ${templateCounter}`,
    goal: "build_muscle",
    experienceTier: "intermediate",
    daysPerWeekMin: 3,
    daysPerWeekMax: 4,
    sessionDurationBand: "45",
    equipmentContext: "full_gym",
    ...overrides,
  };
}

const EXERCISE: ExerciseInput = {
  primaryGoal: "build_muscle",
  recentExperience: "consistent",
  daysPerWeek: "4",
  sessionDurationBand: "45",
  trainingLocation: "full_gym",
  equipmentAccess: ["Full gym access"],
};

describe("selectTemplate", () => {
  it("picks the exact goal/tier/context/band match when one exists", () => {
    const exact = template({});
    const wrongTier = template({ experienceTier: "beginner" });
    const wrongContext = template({ equipmentContext: "home_no_equipment" });
    const result = selectTemplate({ userId: "u1", exercise: EXERCISE, templates: [wrongTier, wrongContext, exact] });
    expect(result.template?.id).toBe(exact.id);
    expect(result.warnings).toHaveLength(0);
  });

  it("hard-filters on goal — never returns a template for a different goal", () => {
    const otherGoal = template({ goal: "lose_fat" });
    const result = selectTemplate({ userId: "u1", exercise: EXERCISE, templates: [otherGoal] });
    expect(result.template).toBeNull();
  });

  it("returns null with no primaryGoal", () => {
    const result = selectTemplate({ userId: "u1", exercise: {}, templates: [template({})] });
    expect(result.template).toBeNull();
    expect(result.tier).toBe("beginner");
  });

  it("relaxes to the nearest tier with a warning when the exact tier is missing", () => {
    const intermediateOnly = template({ experienceTier: "intermediate" });
    const result = selectTemplate({
      userId: "u1",
      exercise: { ...EXERCISE, recentExperience: "highly_experienced" },
      templates: [intermediateOnly],
    });
    expect(result.template?.id).toBe(intermediateOnly.id);
    expect(result.tier).toBe("advanced");
    expect(result.warnings.some((w) => w.includes("intermediate"))).toBe(true);
  });

  it("degrades equipment context downward (full_gym user -> home template) rather than upward", () => {
    const homeBasic = template({ equipmentContext: "home_basic_equipment" });
    const outdoors = template({ equipmentContext: "outdoors" });
    const result = selectTemplate({ userId: "u1", exercise: EXERCISE, templates: [outdoors, homeBasic] });
    expect(result.template?.id).toBe(homeBasic.id);
    expect(result.warnings.some((w) => w.includes("closest match"))).toBe(true);
  });

  it("combination-location users match any context, preferring richer ones", () => {
    const gym = template({ equipmentContext: "full_gym" });
    const none = template({ equipmentContext: "home_no_equipment" });
    const result = selectTemplate({
      userId: "u1",
      exercise: { ...EXERCISE, trainingLocation: "combination" },
      templates: [none, gym],
    });
    expect(result.template?.id).toBe(gym.id);
  });

  it("maps occasional experience conservatively to beginner", () => {
    const result = selectTemplate({
      userId: "u1",
      exercise: { ...EXERCISE, recentExperience: "occasional" },
      templates: [template({ experienceTier: "beginner" })],
    });
    expect(result.tier).toBe("beginner");
  });

  it("warns when the days/week falls outside the chosen template's range", () => {
    const t = template({ daysPerWeekMin: 3, daysPerWeekMax: 4 });
    const result = selectTemplate({ userId: "u1", exercise: { ...EXERCISE, daysPerWeek: "1" }, templates: [t] });
    expect(result.template?.id).toBe(t.id);
    expect(result.warnings.some((w) => w.includes("cycled"))).toBe(true);
  });

  it("is deterministic — same inputs, same template", () => {
    const templates = [template({}), template({}), template({})];
    const a = selectTemplate({ userId: "u1", exercise: EXERCISE, templates });
    const b = selectTemplate({ userId: "u1", exercise: EXERCISE, templates });
    expect(a.template?.id).toBe(b.template?.id);
  });

  it("down-ranks already-completed templates for variety", () => {
    const first = template({});
    const second = template({});
    const fresh = selectTemplate({ userId: "u1", exercise: EXERCISE, templates: [first, second] });
    const afterUse = selectTemplate({
      userId: "u1",
      exercise: EXERCISE,
      templates: [first, second],
      usedTemplateIds: [fresh.template!.id],
    });
    expect(afterUse.template?.id).not.toBe(fresh.template?.id);
  });
});
