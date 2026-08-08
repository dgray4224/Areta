import { describe, expect, it } from "vitest";
import { prescribeSlot } from "@/domains/recommendation/prescribe";
import { resolveTemplateProgression } from "@/domains/recommendation/progression";
import { calculateGoalFirstExerciseParameters } from "@/domains/parameters/exercise-calc-goalfirst";
import type { FilledSlot } from "@/domains/recommendation/types";

function filled(slotOverrides: Partial<FilledSlot["slot"]> = {}, relaxations: string[] = []): FilledSlot {
  return {
    slot: {
      id: "s1",
      sessionId: "sess1",
      slotOrder: 1,
      slotLabel: "Squat pattern",
      movementPattern: "squat",
      modality: "resistance",
      setsMin: 2,
      setsMax: 5,
      repsMin: 8,
      repsMax: 12,
      effortTarget: "RPE 7-8",
      restSeconds: 90,
      durationMinutesMin: null,
      durationMinutesMax: null,
      coachingNotes: null,
      ...slotOverrides,
    },
    exerciseId: "e1",
    provenance: { templateSlotId: "s1", slotLabel: "Squat pattern", score: 0, scoreBreakdown: {}, claimIds: [], relaxations },
    alternatives: [],
  };
}

describe("prescribeSlot — RP-style set ramp", () => {
  it("prescribes sets_min at phase week 1", () => {
    expect(prescribeSlot(filled(), { lengthWeeks: 4 }, 1).sets).toBe(2);
  });

  it("adds one set per week, capped at sets_max", () => {
    expect(prescribeSlot(filled(), { lengthWeeks: 6 }, 2).sets).toBe(3);
    expect(prescribeSlot(filled(), { lengthWeeks: 6 }, 5).sets).toBe(5); // capped at max
  });

  it("deloads back to sets_min on the phase's final week", () => {
    const result = prescribeSlot(filled(), { lengthWeeks: 4 }, 4);
    expect(result.sets).toBe(2);
    expect(result.coachingNotes).toContain("Deload");
  });

  it("parses RPE effort targets into the rpe intensity columns", () => {
    const result = prescribeSlot(filled(), { lengthWeeks: 4 }, 1);
    expect(result.intensityType).toBe("rpe");
    expect(result.intensityValue).toBe("7-8");
  });

  it("ramps aerobic durations from min toward max across the phase", () => {
    const aerobic = filled({ modality: "aerobic", setsMin: null, setsMax: null, repsMin: null, repsMax: null, effortTarget: "easy -- conversational", durationMinutesMin: 30, durationMinutesMax: 45 });
    expect(prescribeSlot(aerobic, { lengthWeeks: 4 }, 1).durationMinutes).toBe(30);
    expect(prescribeSlot(aerobic, { lengthWeeks: 4 }, 3).durationMinutes).toBe(40);
    expect(prescribeSlot(aerobic, { lengthWeeks: 4 }, 4).durationMinutes).toBe(30); // deload
    expect(prescribeSlot(aerobic, { lengthWeeks: 4 }, 1).cardioIntensity).toContain("easy");
  });

  it("flags substituted items when the fill involved relaxations", () => {
    expect(prescribeSlot(filled({}, ["equipment relaxed"]), { lengthWeeks: 4 }, 1).substituted).toBe(true);
    expect(prescribeSlot(filled(), { lengthWeeks: 4 }, 1).substituted).toBe(false);
  });
});

describe("resolveTemplateProgression", () => {
  const lastPlan = { templateId: "t1", templateGoal: "build_muscle", phaseId: "p1", phaseWeekNumber: 2, weekStart: "2026-08-01" };
  const currentPhase = { id: "p1", lengthWeeks: 4, isFinal: false };

  it("selects fresh with no history", () => {
    expect(resolveTemplateProgression({ lastPlan: null, currentGoal: "build_muscle", newWeekStart: "2026-08-08", currentPhase: null, nextPhase: null }).kind).toBe("select_new_template");
  });

  it("continues the phase week by week", () => {
    const d = resolveTemplateProgression({ lastPlan, currentGoal: "build_muscle", newWeekStart: "2026-08-08", currentPhase, nextPhase: { id: "p2" } });
    expect(d).toEqual({ kind: "continue_phase", templateId: "t1", phaseId: "p1", weekNumber: 3 });
  });

  it("advances to the next phase when the current one completes", () => {
    const d = resolveTemplateProgression({
      lastPlan: { ...lastPlan, phaseWeekNumber: 4 },
      currentGoal: "build_muscle",
      newWeekStart: "2026-08-08",
      currentPhase,
      nextPhase: { id: "p2" },
    });
    expect(d).toEqual({ kind: "advance_phase", templateId: "t1", phaseId: "p2" });
  });

  it("reselects when the final phase completes", () => {
    const d = resolveTemplateProgression({
      lastPlan: { ...lastPlan, phaseWeekNumber: 4 },
      currentGoal: "build_muscle",
      newWeekStart: "2026-08-08",
      currentPhase: { ...currentPhase, isFinal: true },
      nextPhase: null,
    });
    expect(d).toEqual({ kind: "select_new_template", reason: "template_completed" });
  });

  it("reselects when the goal changed", () => {
    const d = resolveTemplateProgression({ lastPlan, currentGoal: "lose_fat", newWeekStart: "2026-08-08", currentPhase, nextPhase: null });
    expect(d).toEqual({ kind: "select_new_template", reason: "inputs_changed" });
  });

  it("reselects after a long gap", () => {
    const d = resolveTemplateProgression({ lastPlan, currentGoal: "build_muscle", newWeekStart: "2026-09-15", currentPhase, nextPhase: null });
    expect(d).toEqual({ kind: "select_new_template", reason: "long_gap" });
  });
});

describe("calculateGoalFirstExerciseParameters", () => {
  it("requires primaryGoal and reports it missing", () => {
    const result = calculateGoalFirstExerciseParameters({});
    expect(result.parameters).toHaveLength(0);
    expect(result.missingInputs).toContain("your primary training goal");
  });

  it("emits the same six parameter ids as the legacy calculator", () => {
    const result = calculateGoalFirstExerciseParameters({ primaryGoal: "build_muscle", recentExperience: "consistent", daysPerWeek: "4" });
    expect(result.parameters.map((p) => p.id)).toEqual([
      "sessions_per_week",
      "phase_structure",
      "phase_length_weeks",
      "weekly_progression_cap_pct",
      "deload_frequency_weeks",
      "primary_focus",
    ]);
  });

  it("clamps stated days into the goal's typical range", () => {
    const result = calculateGoalFirstExerciseParameters({ primaryGoal: "build_muscle", recentExperience: "consistent", daysPerWeek: "1" });
    const sessions = result.parameters.find((p) => p.id === "sessions_per_week");
    expect(sessions?.value).toBe(3);
    expect(sessions?.safetyBounds?.some((s) => s.includes("at least 3"))).toBe(true);
  });

  it("parses the 5_plus enum bucket", () => {
    const result = calculateGoalFirstExerciseParameters({ primaryGoal: "improve_endurance", recentExperience: "highly_experienced", daysPerWeek: "5_plus" });
    expect(result.parameters.find((p) => p.id === "sessions_per_week")?.value).toBe(5);
  });

  it("gates demanding goals for true beginners behind professional approval", () => {
    const result = calculateGoalFirstExerciseParameters({ primaryGoal: "get_stronger", recentExperience: "new_or_returning", daysPerWeek: "3" });
    expect(result.parameters[0].requiresProfessionalApproval).toBe(true);
  });

  it("does not gate gentle goals for beginners", () => {
    const result = calculateGoalFirstExerciseParameters({ primaryGoal: "move_and_feel_better", recentExperience: "new_or_returning", daysPerWeek: "2" });
    expect(result.parameters[0].requiresProfessionalApproval).toBeUndefined();
  });
});
