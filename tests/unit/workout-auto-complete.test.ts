import { describe, expect, it } from "vitest";
import { itemsToAutoComplete, MIN_WORKOUT_MINUTES } from "@/domains/workoutplan/auto-complete";

const planned = (id: string, date: string, completedAt: string | null = null) => ({ id, date, completedAt });

describe("itemsToAutoComplete", () => {
  it("completes a planned day that Health recorded a real session on", () => {
    expect(
      itemsToAutoComplete({
        plannedItems: [planned("a", "2026-09-15"), planned("b", "2026-09-15")],
        recordedWorkouts: [{ date: "2026-09-15", durationMinutes: 42 }],
      })
    ).toEqual(["a", "b"]);
  });

  it("leaves a planned day alone when nothing was recorded", () => {
    expect(
      itemsToAutoComplete({
        plannedItems: [planned("a", "2026-09-15")],
        recordedWorkouts: [{ date: "2026-09-16", durationMinutes: 42 }],
      })
    ).toEqual([]);
  });

  it("ignores a stray short recording rather than crediting a session", () => {
    expect(
      itemsToAutoComplete({
        plannedItems: [planned("a", "2026-09-15")],
        recordedWorkouts: [{ date: "2026-09-15", durationMinutes: MIN_WORKOUT_MINUTES - 1 }],
      })
    ).toEqual([]);
  });

  it("adds up several short sessions in one day", () => {
    expect(
      itemsToAutoComplete({
        plannedItems: [planned("a", "2026-09-15")],
        recordedWorkouts: [
          { date: "2026-09-15", durationMinutes: 6 },
          { date: "2026-09-15", durationMinutes: 6 },
        ],
      })
    ).toEqual(["a"]);
  });

  it("treats the threshold as inclusive", () => {
    expect(
      itemsToAutoComplete({
        plannedItems: [planned("a", "2026-09-15")],
        recordedWorkouts: [{ date: "2026-09-15", durationMinutes: MIN_WORKOUT_MINUTES }],
      })
    ).toEqual(["a"]);
  });

  // A person who ticked it, or deliberately unticked it, outranks the
  // inference — otherwise every sync would silently overrule them.
  it("never touches an item that is already complete", () => {
    expect(
      itemsToAutoComplete({
        plannedItems: [planned("a", "2026-09-15", "2026-09-15T18:00:00Z")],
        recordedWorkouts: [{ date: "2026-09-15", durationMinutes: 42 }],
      })
    ).toEqual([]);
  });

  it("completes only the days that were actually trained", () => {
    expect(
      itemsToAutoComplete({
        plannedItems: [planned("mon", "2026-09-14"), planned("tue", "2026-09-15"), planned("wed", "2026-09-16")],
        recordedWorkouts: [
          { date: "2026-09-14", durationMinutes: 30 },
          { date: "2026-09-16", durationMinutes: 55 },
        ],
      })
    ).toEqual(["mon", "wed"]);
  });

  it("ignores zero and nonsense durations", () => {
    expect(
      itemsToAutoComplete({
        plannedItems: [planned("a", "2026-09-15")],
        recordedWorkouts: [
          { date: "2026-09-15", durationMinutes: 0 },
          { date: "2026-09-15", durationMinutes: Number.NaN },
        ],
      })
    ).toEqual([]);
  });
});
