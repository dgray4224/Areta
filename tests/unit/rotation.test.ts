import { describe, expect, it } from "vitest";
import { selectProgram, resolveProgression } from "@/domains/workoutplan/rotation";
import type { TrainingProgram, TrainingProgramPhase } from "@/domains/trainingprogram/types";

function program(overrides: Partial<TrainingProgram>): TrainingProgram {
  return {
    id: "p1",
    archetype: "powerlifter",
    slug: "test-program",
    name: "Test Program",
    description: null,
    methodologyNote: null,
    experienceLevel: "beginner",
    sessionsPerWeekMin: 3,
    sessionsPerWeekMax: 4,
    equipmentRequired: ["Barbell", "Full gym access"],
    isActive: true,
    displayOrder: 0,
    ...overrides,
  };
}

function phase(overrides: Partial<TrainingProgramPhase>): TrainingProgramPhase {
  return {
    id: "phase1",
    programId: "p1",
    phaseOrder: 1,
    name: "Phase 1",
    focus: null,
    lengthWeeks: 4,
    intensityStyle: null,
    isFinal: false,
    ...overrides,
  };
}

describe("selectProgram", () => {
  const candidates: TrainingProgram[] = [
    program({ id: "p1", experienceLevel: "beginner" }),
    program({ id: "p2", experienceLevel: "intermediate" }),
    program({ id: "p3", experienceLevel: "advanced" }),
  ];

  it("returns null with a warning when there are no candidates at all", () => {
    const result = selectProgram({
      userId: "u1",
      archetype: "powerlifter",
      candidates: [],
      equipmentAccess: ["Full gym access"],
      experienceLevel: "beginner",
      sessionsPerWeek: 4,
      usedProgramIds: [],
    });
    expect(result.program).toBeNull();
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("excludes programs already in the user's history when unused ones remain", () => {
    const result = selectProgram({
      userId: "u1",
      archetype: "powerlifter",
      candidates,
      equipmentAccess: ["Full gym access"],
      experienceLevel: "advanced",
      sessionsPerWeek: 4,
      usedProgramIds: ["p1", "p2"],
    });
    expect(result.program?.id).toBe("p3");
  });

  it("is deterministic -- the same inputs always resolve to the same program", () => {
    const input = {
      userId: "u42",
      archetype: "powerlifter",
      candidates,
      equipmentAccess: ["Full gym access"],
      experienceLevel: "advanced" as const,
      sessionsPerWeek: 4,
      usedProgramIds: [],
    };
    const first = selectProgram(input);
    const second = selectProgram(input);
    expect(first.program?.id).toBe(second.program?.id);
  });

  it("falls back to the least-recently-used program when every candidate has been used", () => {
    const result = selectProgram({
      userId: "u1",
      archetype: "powerlifter",
      candidates,
      equipmentAccess: ["Full gym access"],
      experienceLevel: "advanced",
      sessionsPerWeek: 4,
      usedProgramIds: ["p1", "p2", "p3"],
      lastUsedByProgramId: new Map([
        ["p1", "2026-01-01"],
        ["p2", "2026-06-01"],
        ["p3", "2026-03-01"],
      ]),
    });
    expect(result.program?.id).toBe("p1");
    expect(result.warnings.some((w) => w.includes("least recently"))).toBe(true);
  });

  it("relaxes the experience-level filter with a warning when nothing matches at the user's level", () => {
    const result = selectProgram({
      userId: "u1",
      archetype: "powerlifter",
      candidates: [program({ id: "p1", experienceLevel: "advanced" })],
      equipmentAccess: ["Full gym access"],
      experienceLevel: "beginner",
      sessionsPerWeek: 4,
      usedProgramIds: [],
    });
    expect(result.program?.id).toBe("p1");
    expect(result.warnings.some((w) => w.includes("experience-level"))).toBe(true);
  });

  it("relaxes the equipment filter with a warning when nothing matches the user's equipment", () => {
    const result = selectProgram({
      userId: "u1",
      archetype: "powerlifter",
      candidates: [program({ id: "p1", equipmentRequired: ["Barbell", "Full gym access"] })],
      equipmentAccess: ["Bodyweight only"],
      experienceLevel: "beginner",
      sessionsPerWeek: 4,
      usedProgramIds: [],
    });
    expect(result.program?.id).toBe("p1");
    expect(result.warnings.some((w) => w.includes("equipment"))).toBe(true);
  });
});

describe("resolveProgression", () => {
  it("selects a new program when there's no prior plan", () => {
    const decision = resolveProgression({
      lastPlan: null,
      currentArchetype: "powerlifter",
      newWeekStart: "2026-08-03",
      currentPhase: null,
      nextPhase: null,
    });
    expect(decision).toEqual({ kind: "select_new_program", reason: "no_history" });
  });

  it("selects a new program when the user's archetype has changed", () => {
    const decision = resolveProgression({
      lastPlan: {
        programId: "p1",
        programArchetype: "hypertrophy",
        phaseId: "phase1",
        phaseWeekNumber: 1,
        weekStart: "2026-07-27",
      },
      currentArchetype: "powerlifter",
      newWeekStart: "2026-08-03",
      currentPhase: phase({}),
      nextPhase: null,
    });
    expect(decision).toEqual({ kind: "select_new_program", reason: "archetype_changed" });
  });

  it("selects a new program when the gap since the last plan exceeds the threshold", () => {
    const decision = resolveProgression({
      lastPlan: {
        programId: "p1",
        programArchetype: "powerlifter",
        phaseId: "phase1",
        phaseWeekNumber: 1,
        weekStart: "2026-06-01",
      },
      currentArchetype: "powerlifter",
      newWeekStart: "2026-08-03",
      currentPhase: phase({}),
      nextPhase: null,
    });
    expect(decision).toEqual({ kind: "select_new_program", reason: "long_gap" });
  });

  it("continues the current phase when weeks remain in it", () => {
    const decision = resolveProgression({
      lastPlan: {
        programId: "p1",
        programArchetype: "powerlifter",
        phaseId: "phase1",
        phaseWeekNumber: 2,
        weekStart: "2026-07-27",
      },
      currentArchetype: "powerlifter",
      newWeekStart: "2026-08-03",
      currentPhase: phase({ lengthWeeks: 4 }),
      nextPhase: null,
    });
    expect(decision).toEqual({ kind: "continue_phase", programId: "p1", phaseId: "phase1", weekNumber: 3 });
  });

  it("advances to the next phase when the current phase's weeks are exhausted and it isn't final", () => {
    const decision = resolveProgression({
      lastPlan: {
        programId: "p1",
        programArchetype: "powerlifter",
        phaseId: "phase1",
        phaseWeekNumber: 4,
        weekStart: "2026-07-27",
      },
      currentArchetype: "powerlifter",
      newWeekStart: "2026-08-03",
      currentPhase: phase({ lengthWeeks: 4, isFinal: false }),
      nextPhase: phase({ id: "phase2", phaseOrder: 2 }),
    });
    expect(decision).toEqual({ kind: "advance_phase", programId: "p1", phaseId: "phase2" });
  });

  it("selects a new program when the final phase's weeks are exhausted", () => {
    const decision = resolveProgression({
      lastPlan: {
        programId: "p1",
        programArchetype: "powerlifter",
        phaseId: "phase3",
        phaseWeekNumber: 2,
        weekStart: "2026-07-27",
      },
      currentArchetype: "powerlifter",
      newWeekStart: "2026-08-03",
      currentPhase: phase({ id: "phase3", phaseOrder: 3, lengthWeeks: 2, isFinal: true }),
      nextPhase: null,
    });
    expect(decision).toEqual({ kind: "select_new_program", reason: "program_completed" });
  });

  it("selects a new program when weeks are exhausted and no next phase exists, even if not marked final", () => {
    const decision = resolveProgression({
      lastPlan: {
        programId: "p1",
        programArchetype: "powerlifter",
        phaseId: "phase3",
        phaseWeekNumber: 2,
        weekStart: "2026-07-27",
      },
      currentArchetype: "powerlifter",
      newWeekStart: "2026-08-03",
      currentPhase: phase({ id: "phase3", phaseOrder: 3, lengthWeeks: 2, isFinal: false }),
      nextPhase: null,
    });
    expect(decision).toEqual({ kind: "select_new_program", reason: "program_completed" });
  });
});
