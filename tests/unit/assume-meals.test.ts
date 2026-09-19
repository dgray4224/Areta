import { describe, expect, it } from "vitest";
import { itemsToAssumeEaten, MAX_ASSUME_LOOKBACK_DAYS } from "@/domains/mealplan/assume-meals";

const TODAY = "2026-09-19";
const item = (
  id: string,
  date: string,
  overrides: { completedAt?: string | null; skippedAt?: string | null } = {}
) => ({ id, date, completedAt: overrides.completedAt ?? null, skippedAt: overrides.skippedAt ?? null });

describe("itemsToAssumeEaten", () => {
  it("assumes a finished day nobody answered about", () => {
    expect(itemsToAssumeEaten({ items: [item("a", "2026-09-18")], today: TODAY })).toEqual(["a"]);
  });

  // Today is still being lived. Claiming tonight's dinner at lunchtime
  // would have the app assert something before the person did.
  it("never assumes today", () => {
    expect(itemsToAssumeEaten({ items: [item("a", TODAY)], today: TODAY })).toEqual([]);
  });

  it("never assumes a future day", () => {
    expect(itemsToAssumeEaten({ items: [item("a", "2026-09-21")], today: TODAY })).toEqual([]);
  });

  it("leaves a meal the person confirmed alone", () => {
    expect(
      itemsToAssumeEaten({ items: [item("a", "2026-09-18", { completedAt: "2026-09-18T19:00:00Z" })], today: TODAY })
    ).toEqual([]);
  });

  // The whole reason skipped_at exists: without it, declining a meal and
  // never being asked look identical, and the next pass overrules them.
  it("leaves a meal the person declined alone", () => {
    expect(
      itemsToAssumeEaten({ items: [item("a", "2026-09-18", { skippedAt: "2026-09-18T19:00:00Z" })], today: TODAY })
    ).toEqual([]);
  });

  it("stops at the lookback so a long absence is not invented in one pass", () => {
    const justInside = item("in", "2026-09-16");
    const tooOld = item("out", "2026-09-10");
    expect(itemsToAssumeEaten({ items: [justInside, tooOld], today: TODAY })).toEqual(["in"]);
  });

  it("treats the lookback boundary as inclusive", () => {
    const boundary = new Date(Date.parse(`${TODAY}T00:00:00Z`) - MAX_ASSUME_LOOKBACK_DAYS * 86_400_000)
      .toISOString()
      .slice(0, 10);
    expect(itemsToAssumeEaten({ items: [item("a", boundary)], today: TODAY })).toEqual(["a"]);
  });

  it("assumes every unanswered meal across several finished days", () => {
    expect(
      itemsToAssumeEaten({
        items: [item("a", "2026-09-17"), item("b", "2026-09-17"), item("c", "2026-09-18")],
        today: TODAY,
      })
    ).toEqual(["a", "b", "c"]);
  });
});
