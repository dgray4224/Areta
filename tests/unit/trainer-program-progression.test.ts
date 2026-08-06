import { describe, expect, it } from "vitest";
import { resolveTrainerProgramProgression } from "@/domains/trainerprogram/progression";
import type { TrainerProgramPhase } from "@/domains/trainerprogram/types";

function phase(overrides: Partial<TrainerProgramPhase>): TrainerProgramPhase {
  return {
    id: "phase1",
    programId: "p1",
    phaseOrder: 1,
    name: "Phase 1",
    focus: null,
    lengthWeeks: 4,
    isFinal: false,
    ...overrides,
  };
}

describe("resolveTrainerProgramProgression", () => {
  it("stays in the same phase and increments the week when under length_weeks", () => {
    const currentPhase = phase({ lengthWeeks: 4 });
    const result = resolveTrainerProgramProgression({
      currentPhase,
      currentWeekNumber: 2,
      nextPhase: null,
      firstPhase: currentPhase,
      onComplete: "repeat",
    });
    expect(result).toEqual({ phaseId: "phase1", weekNumber: 3 });
  });

  it("advances to the next phase at week 1 once length_weeks is reached", () => {
    const currentPhase = phase({ id: "phase1", lengthWeeks: 4, isFinal: false });
    const nextPhase = phase({ id: "phase2", phaseOrder: 2, lengthWeeks: 6 });
    const result = resolveTrainerProgramProgression({
      currentPhase,
      currentWeekNumber: 4,
      nextPhase,
      firstPhase: currentPhase,
      onComplete: "repeat",
    });
    expect(result).toEqual({ phaseId: "phase2", weekNumber: 1 });
  });

  it("loops back to the first phase when the final phase completes and onComplete is 'repeat'", () => {
    const firstPhase = phase({ id: "phase1", lengthWeeks: 4 });
    const finalPhase = phase({ id: "phase2", phaseOrder: 2, lengthWeeks: 6, isFinal: true });
    const result = resolveTrainerProgramProgression({
      currentPhase: finalPhase,
      currentWeekNumber: 6,
      nextPhase: null,
      firstPhase,
      onComplete: "repeat",
    });
    expect(result).toEqual({ phaseId: "phase1", weekNumber: 1 });
  });

  it("freezes on the final week of the final phase when onComplete is 'freeze'", () => {
    const firstPhase = phase({ id: "phase1", lengthWeeks: 4 });
    const finalPhase = phase({ id: "phase2", phaseOrder: 2, lengthWeeks: 6, isFinal: true });
    const result = resolveTrainerProgramProgression({
      currentPhase: finalPhase,
      currentWeekNumber: 6,
      nextPhase: null,
      firstPhase,
      onComplete: "freeze",
    });
    expect(result).toEqual({ phaseId: "phase2", weekNumber: 6 });
    // Calling it again with the same (frozen) state should be a no-op fixed point.
    const again = resolveTrainerProgramProgression({
      currentPhase: finalPhase,
      currentWeekNumber: result.weekNumber,
      nextPhase: null,
      firstPhase,
      onComplete: "freeze",
    });
    expect(again).toEqual({ phaseId: "phase2", weekNumber: 6 });
  });

  it("a single-phase program with onComplete 'repeat' loops on itself", () => {
    const onlyPhase = phase({ id: "phase1", lengthWeeks: 3, isFinal: true });
    const result = resolveTrainerProgramProgression({
      currentPhase: onlyPhase,
      currentWeekNumber: 3,
      nextPhase: null,
      firstPhase: onlyPhase,
      onComplete: "repeat",
    });
    expect(result).toEqual({ phaseId: "phase1", weekNumber: 1 });
  });
});
