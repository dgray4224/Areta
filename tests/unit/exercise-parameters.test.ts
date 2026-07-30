import { describe, expect, it } from "vitest";
import { calculateExerciseParameters } from "@/domains/parameters/exercise-calc";
import { EXERCISE_ARCHETYPES } from "@/domains/exercise/schema";

function findParam(params: ReturnType<typeof calculateExerciseParameters>["parameters"], id: string) {
  const p = params.find((x) => x.id === id);
  if (!p) throw new Error(`Missing parameter ${id}`);
  return p;
}

describe("calculateExerciseParameters", () => {
  it("returns no parameters when archetype is missing", () => {
    const result = calculateExerciseParameters({});
    expect(result.parameters).toHaveLength(0);
    expect(result.missingInputs.length).toBeGreaterThan(0);
  });

  it.each(EXERCISE_ARCHETYPES)("computes a full parameter set for archetype %s", (archetype) => {
    const result = calculateExerciseParameters({
      archetype,
      experienceLevel: "intermediate",
      trainingPhaseLengthWeeks: 8,
      daysPerWeekAvailable: 4,
    });

    expect(result.missingInputs).toHaveLength(0);
    expect(findParam(result.parameters, "sessions_per_week").value).toBeGreaterThan(0);
    expect(findParam(result.parameters, "phase_length_weeks").value).toBe(8);
    expect(findParam(result.parameters, "primary_focus").value).toBeTruthy();
  });

  it("clamps an out-of-range phase length and flags it", () => {
    const result = calculateExerciseParameters({
      archetype: "general_fitness",
      experienceLevel: "intermediate",
      trainingPhaseLengthWeeks: 30,
    });

    const phase = findParam(result.parameters, "phase_length_weeks");
    expect(phase.value as number).toBeLessThanOrEqual(16);
    expect(phase.safetyBounds?.length ?? 0).toBeGreaterThan(0);
  });

  it("flags beginner + aggressive archetype combinations for professional approval", () => {
    const result = calculateExerciseParameters({
      archetype: "powerlifter",
      experienceLevel: "beginner",
    });

    const sessions = findParam(result.parameters, "sessions_per_week");
    expect(sessions.requiresProfessionalApproval).toBe(true);
    expect(sessions.safetyBounds?.length ?? 0).toBeGreaterThan(0);
  });

  it("does not require professional approval for a beginner in general_fitness", () => {
    const result = calculateExerciseParameters({
      archetype: "general_fitness",
      experienceLevel: "beginner",
    });

    const sessions = findParam(result.parameters, "sessions_per_week");
    expect(sessions.requiresProfessionalApproval).toBeUndefined();
  });

  it("clamps sessions per week to the archetype's typical range", () => {
    const result = calculateExerciseParameters({
      archetype: "general_fitness",
      daysPerWeekAvailable: 7,
    });

    const sessions = findParam(result.parameters, "sessions_per_week");
    expect(sessions.value as number).toBeLessThanOrEqual(4);
  });

  it("records assumptions when optional inputs default", () => {
    const result = calculateExerciseParameters({ archetype: "hypertrophy" });

    const sessions = findParam(result.parameters, "sessions_per_week");
    expect(sessions.assumptions.length).toBeGreaterThan(0);
    expect(sessions.confidence).toBe(0.8);
  });

  it("lowers confidence when the required archetype is missing", () => {
    const result = calculateExerciseParameters({});
    expect(result.parameters).toHaveLength(0);
  });
});
