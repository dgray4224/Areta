import { describe, expect, it } from "vitest";
import { findBriefViolations, generateCheckedBrief } from "@/domains/review/brief-check";
import type { WeeklyBrief } from "@/domains/review/brief-schema";
import type { AIProvider } from "@/platform/ai/provider";

function brief(overrides: Partial<WeeklyBrief> = {}): WeeklyBrief {
  return {
    narrative: ["You trained on 3 of your 7 planned days.", "In the winter you held 4.3 days a week for a month."],
    priorities: [{ title: "Train all 7 planned days", reason: "That is the plan you set.", domain: "training", priority: 1 }],
    changes: [],
    highestLeverageAction: "**Put all 7 sessions on your calendar tonight.**",
    weeklyMottoId: "rohn_bridge",
    ...overrides,
  } as WeeklyBrief;
}

const facts = { workoutsPlanned: 7 };

describe("findBriefViolations", () => {
  it("passes a clean brief", () => {
    expect(findBriefViolations(brief(), facts)).toEqual([]);
  });

  it("allows statements about what happened", () => {
    const b = brief({
      narrative: ["You did 3 sessions this week, 3 of your 7.", "You only managed 2 days last week."],
      // Both of these were real false positives.
      priorities: [{ title: "Hit all 7", reason: "Your best stretch was 4.3 days a week for a month.", domain: "training", priority: 1 }],
      highestLeverageAction: "**Put all 7 on the calendar, starting with the four days that have slipped.**",
    });
    expect(findBriefViolations(b, facts)).toEqual([]);
  });

  // Each of these made it into a real preview on 2026-09-27.
  it.each([
    ["an internal field name", { narrative: ["Your proteinAdherencePercent was 68.", "x"] }],
    ["app mechanics", { narrative: ["No weight was logged this week.", "x"] }],
    ["a bare score", { narrative: ["Your best week — a score of 74.", "x"] }],
    ["its own rules", { narrative: ["You haven't missed enough weeks in a row to change it.", "x"] }],
    ["an invented habit", { highestLeverageAction: "Protect Sunday, the day you keep missing." }],
    ["a target below the plan", { highestLeverageAction: "**Pick your three days for next week right now.**" }],
    ["a claim about why they stopped", { narrative: ["Nothing physically changed between then and now except the choice to show up.", "x"] }],
    ["calling it a choice", { narrative: ["Here's what makes that a choice, not a ceiling.", "x"] }],
    ["a claim that the body is fine", { narrative: ["Nothing here saying your body can't handle more; the gap is purely about showing up.", "x"] }],
    ["a stat-heavy narrative", { narrative: ["3 of 7, 0.5 and 0.7 averages, 4.3 best, 3 floor, 69 RHR, 29.3 HRV, 1,084 steps, 20 lbs, 12 weeks.", "x"] }],
    ["a claim about their body", { narrative: ["You did it on a body that's clearly capable of it.", "x"] }],
    ["a claim the gap isn't ability", { narrative: ["The gap isn't ability. It's the days.", "x"] }],
    ["a claim it isn't about capacity", { narrative: ["Here's the proof this isn't about capacity.", "x"] }],
    ["explaining the plan won't change", { narrative: ["One missed week isn't enough to change the plan.", "x"] }],
    [
      "a change that changes nothing",
      {
        changes: [
          { field: "Training days per week", previousValue: "7 sessions/week plan", proposedValue: "7 sessions/week plan (kept as-is)", reason: "Execute it.", confidence: 0.5 },
        ],
      },
    ],
    ["a stepping-stone target", { priorities: [{ title: "Build toward 4-5 days next week", reason: "r", domain: "training", priority: 1 as const }] }],
  ])("flags %s", (_label, overrides) => {
    expect(findBriefViolations(brief(overrides as Partial<WeeklyBrief>), facts)).toHaveLength(1);
  });

  it("flags explaining that the plan doesn't need to change", () => {
    const b = brief({ narrative: ["The plan didn't change, and it doesn't need to.", "x"] });
    expect(findBriefViolations(b, facts)).toHaveLength(1);
  });

  describe("claiming they've done the plan", () => {
    const b = brief({ narrative: ["You already know how to run a full week.", "You know what seven days looks like."] });
    it("flags it when their best stretch falls short of the plan", () => {
      expect(findBriefViolations(b, { ...facts, bestStretchReachesPlan: false })).toHaveLength(1);
    });
    it("allows it when their best stretch reached the plan", () => {
      expect(findBriefViolations(b, { ...facts, bestStretchReachesPlan: true })).toEqual([]);
    });
  });

  describe("repeating last week", () => {
    const last = [
      "Three of seven. That's what got done this week.",
      "Every session you keep is a brick on top of your foundation. Stack them.",
    ];
    it("flags the same opening", () => {
      const b = brief({ narrative: ["Three of seven again, and you know it.", "x"] });
      expect(findBriefViolations(b, { ...facts, lastBriefText: last })).toEqual([
        "the narrative opens the same way as last week's brief. Open differently.",
      ]);
    });
    it("flags a reused line", () => {
      const b = brief({ narrative: ["Four sessions.", "Every session you keep is a brick on top of your foundation."] });
      expect(findBriefViolations(b, { ...facts, lastBriefText: last })[0]).toContain("repeats a line");
    });
    it("flags an opening that only varies after two words", () => {
      const b = brief({ narrative: ["Three sessions again. You know why this matters.", "x"] });
      const lastWeek = ["Three sessions out of seven. That's the truth of this week."];
      expect(findBriefViolations(b, { ...facts, lastBriefText: lastWeek })).toHaveLength(1);
    });
    it("allows citing the same record again", () => {
      const lastWeek = ["In December you trained 4.3 days a week for a month."];
      const b = brief({ narrative: ["Different start.", "In December you trained 4.3 days a week for a month."] });
      expect(findBriefViolations(b, { ...facts, lastBriefText: lastWeek })).toEqual([]);
    });
    it("allows the same days slipping two weeks running", () => {
      const days = ["You missed Sunday, Monday, Tuesday and Thursday last week."];
      const b = brief({ narrative: ["Four sessions short.", "Sunday, Monday, Tuesday and Thursday slipped."] });
      expect(findBriefViolations(b, { ...facts, lastBriefText: days })).toEqual([]);
    });
  });

  it("does not police training numbers when there is no plan", () => {
    expect(findBriefViolations(brief({ highestLeverageAction: "Train three days this week." }), { workoutsPlanned: 0 })).toEqual([]);
  });
});

describe("generateCheckedBrief", () => {
  function provider(...drafts: WeeklyBrief[]): AIProvider & { calls: Record<string, unknown>[] } {
    const calls: Record<string, unknown>[] = [];
    return {
      calls,
      async generateStructured(request) {
        calls.push(request.context);
        return { ok: true, data: drafts[calls.length - 1] } as never;
      },
    };
  }

  it("keeps a clean first draft without a second call", async () => {
    const p = provider(brief());
    const result = await generateCheckedBrief(p, "i", {}, facts);
    expect(result.ok && result.revised).toBe(false);
    expect(p.calls).toHaveLength(1);
  });

  it("rewrites once with the problems named, and keeps the better draft", async () => {
    const bad = brief({ highestLeverageAction: "Pick your three days." });
    const p = provider(bad, brief());
    const result = await generateCheckedBrief(p, "i", {}, facts);
    expect(result.ok && result.revised).toBe(true);
    expect(p.calls[1].problemsToFix).toHaveLength(1);
    expect(p.calls[1].previousDraft).toEqual(bad);
  });

  it("tries a second rewrite when the first introduces a new problem", async () => {
    const p = provider(
      brief({ highestLeverageAction: "Pick your three days." }),
      brief({ narrative: ["No weight was logged.", "x"] }),
      brief()
    );
    const result = await generateCheckedBrief(p, "i", {}, facts);
    expect(p.calls).toHaveLength(3);
    expect(result.ok && result.remainingProblems).toEqual([]);
  });

  it("adds the judge's problems to the pattern check's", async () => {
    const p = provider(brief(), brief({ narrative: ["Clean rewrite.", "Still clean."] }));
    let judged = 0;
    const judge = async () => (judged++ === 0 ? ['"a choice" claims to know why.'] : []);
    const result = await generateCheckedBrief(p, "i", {}, facts, judge);
    expect(p.calls).toHaveLength(2);
    expect(p.calls[1].problemsToFix).toEqual(['"a choice" claims to know why.']);
    expect(result.ok && result.remainingProblems).toEqual([]);
  });

  it("falls back to the first draft when the rewrite is worse", async () => {
    const bad = brief({ highestLeverageAction: "Pick your three days." });
    const worse = brief({ highestLeverageAction: "Pick your three days!", narrative: ["No weight logged.", "x"] });
    const result = await generateCheckedBrief(provider(bad, worse, worse), "i", {}, facts);
    expect(result.ok && result.data).toEqual(bad);
  });
});
