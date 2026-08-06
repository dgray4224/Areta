import { describe, expect, it } from "vitest";
import { projectProgramRange, type DateOverrideInput } from "@/domains/trainerprogram/calendar-projection";
import type { HydratedTrainerProgramPhase } from "@/domains/trainerprogram/types";

function phase(overrides: Partial<HydratedTrainerProgramPhase>): HydratedTrainerProgramPhase {
  return {
    id: "phase1",
    programId: "p1",
    phaseOrder: 1,
    name: "Phase 1",
    focus: null,
    lengthWeeks: 4,
    isFinal: false,
    sessions: [],
    ...overrides,
  };
}

function session(dayOfWeek: number, exerciseId = "ex1") {
  return {
    id: `session-${dayOfWeek}`,
    phaseId: "phase1",
    dayOfWeek,
    name: `Day ${dayOfWeek}`,
    sessionType: null,
    exercises: [
      {
        id: `sesex-${dayOfWeek}`,
        sessionId: `session-${dayOfWeek}`,
        exerciseOrder: 0,
        exerciseId,
        sets: 3,
        repsMin: 8,
        repsMax: 12,
        intensityType: null,
        intensityValue: null,
        durationMinutes: null,
        cardioIntensity: null,
        coachingNotes: null,
      },
    ],
  };
}

describe("projectProgramRange", () => {
  it("marks dates before startsOn as not_started", () => {
    const phases = [phase({ sessions: [session(1)] })];
    const days = projectProgramRange({
      startsOn: "2026-08-10",
      phases,
      onComplete: "repeat",
      rangeStart: "2026-08-08",
      rangeEnd: "2026-08-09",
      overridesByDate: new Map(),
    });
    expect(days.every((d) => d.source === "not_started")).toBe(true);
  });

  it("resolves the template session for a matching day-of-week, and rest for a non-matching one", () => {
    // 2026-08-10 is a Monday (dayOfWeek 1).
    const phases = [phase({ sessions: [session(1)] })];
    const days = projectProgramRange({
      startsOn: "2026-08-10",
      phases,
      onComplete: "repeat",
      rangeStart: "2026-08-10",
      rangeEnd: "2026-08-11",
      overridesByDate: new Map(),
    });
    expect(days[0]).toMatchObject({ date: "2026-08-10", source: "template", weekInPhase: 1 });
    expect(days[1]).toMatchObject({ date: "2026-08-11", source: "rest" });
  });

  it("advances to the next phase once length_weeks elapses", () => {
    const phaseOne = phase({ id: "p1", lengthWeeks: 1, sessions: [session(1)] });
    const phaseTwo = phase({ id: "p2", phaseOrder: 2, lengthWeeks: 1, isFinal: true, sessions: [session(1)] });
    // startsOn is a Monday; phase 1 covers week 0 (that Monday), phase 2 covers week 1 (the following Monday).
    const days = projectProgramRange({
      startsOn: "2026-08-10",
      phases: [phaseOne, phaseTwo],
      onComplete: "repeat",
      rangeStart: "2026-08-10",
      rangeEnd: "2026-08-17",
      overridesByDate: new Map(),
    });
    const week1 = days.find((d) => d.date === "2026-08-10");
    const week2 = days.find((d) => d.date === "2026-08-17");
    expect(week1?.phaseId).toBe("p1");
    expect(week2?.phaseId).toBe("p2");
    expect(week2?.weekInPhase).toBe(1);
  });

  it("loops back to phase 1 on repeat once the cycle completes", () => {
    const onlyPhase = phase({ id: "p1", lengthWeeks: 1, isFinal: true, sessions: [session(1)] });
    const days = projectProgramRange({
      startsOn: "2026-08-10",
      phases: [onlyPhase],
      onComplete: "repeat",
      rangeStart: "2026-08-10",
      rangeEnd: "2026-08-24",
      overridesByDate: new Map(),
    });
    const threeWeeksLater = days.find((d) => d.date === "2026-08-24");
    expect(threeWeeksLater?.phaseId).toBe("p1");
    expect(threeWeeksLater?.weekInPhase).toBe(1);
  });

  it("freezes on the final week once the cycle completes with onComplete 'freeze'", () => {
    const onlyPhase = phase({ id: "p1", lengthWeeks: 2, isFinal: true, sessions: [session(1)] });
    const days = projectProgramRange({
      startsOn: "2026-08-10",
      phases: [onlyPhase],
      onComplete: "freeze",
      rangeStart: "2026-08-10",
      rangeEnd: "2026-09-07",
      overridesByDate: new Map(),
    });
    const farFuture = days.find((d) => d.date === "2026-09-07");
    expect(farFuture?.phaseId).toBe("p1");
    expect(farFuture?.weekInPhase).toBe(2);
  });

  it("an override takes precedence over the template, including marking a template session day as rest", () => {
    const phases = [phase({ sessions: [session(1)] })];
    const override: DateOverrideInput = { isRestDay: true, exercises: [] };
    const days = projectProgramRange({
      startsOn: "2026-08-10",
      phases,
      onComplete: "repeat",
      rangeStart: "2026-08-10",
      rangeEnd: "2026-08-10",
      overridesByDate: new Map([["2026-08-10", override]]),
    });
    expect(days[0].source).toBe("override");
    expect(days[0].exercises).toEqual([]);
  });

  it("an override can add exercises to a day with no template session", () => {
    const phases = [phase({ sessions: [session(1)] })];
    const override: DateOverrideInput = {
      isRestDay: false,
      exercises: [
        {
          exerciseId: "ex9",
          sets: 3,
          repsMin: 10,
          repsMax: 10,
          intensityType: null,
          intensityValue: null,
          durationMinutes: null,
          cardioIntensity: null,
          coachingNotes: null,
          sourceSessionExerciseId: null,
        },
      ],
    };
    // 2026-08-11 is a Tuesday, no template session exists for it above.
    const days = projectProgramRange({
      startsOn: "2026-08-10",
      phases,
      onComplete: "repeat",
      rangeStart: "2026-08-11",
      rangeEnd: "2026-08-11",
      overridesByDate: new Map([["2026-08-11", override]]),
    });
    expect(days[0].source).toBe("override");
    expect(days[0].exercises).toHaveLength(1);
    expect(days[0].exercises[0].exerciseId).toBe("ex9");
  });
});
