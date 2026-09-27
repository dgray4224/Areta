import { describe, expect, it } from "vitest";
import { judgeBrief, type JudgeFacts } from "@/domains/review/brief-judge";
import type { WeeklyBrief } from "@/domains/review/brief-schema";
import type { AIProvider } from "@/platform/ai/provider";

const brief = {
  narrative: [
    "Three sessions. The gap between then and now isn't ability, it's which days you protect.",
    "In December you trained 4.3 days a week.",
  ],
  priorities: [{ title: "Hit all 7", reason: "It's the plan.", domain: "training", priority: 1 }],
  changes: [],
  highestLeverageAction: "**Book all 7 sessions.**",
  weeklyMottoId: "rohn_bridge",
} as unknown as WeeklyBrief;

const facts: JudgeFacts = {
  plannedSessions: 7,
  bestStretchDaysPerWeek: 4.3,
  bestStretchReachesPlan: false,
  missedWeeksInARow: 1,
  interviewAnswers: {},
};

function judging(result: unknown): AIProvider & { tiers: unknown[] } {
  const tiers: unknown[] = [];
  return {
    tiers,
    async generateStructured(request) {
      tiers.push(request.tier);
      if (result instanceof Error) throw result;
      return result as never;
    },
  };
}

describe("judgeBrief", () => {
  it("turns a quoted violation into a problem, using the fast model", async () => {
    const p = judging({
      ok: true,
      data: { violations: [{ rule: "cause", quote: "isn't ability", why: "claims a cause" }] },
    });
    const problems = await judgeBrief(p, brief, facts);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("isn't ability");
    expect(p.tiers).toEqual(["fast"]);
  });

  // The judge must not be able to invent a problem the brief doesn't have.
  it("drops a violation whose quote isn't in the brief", async () => {
    const p = judging({
      ok: true,
      data: { violations: [{ rule: "habit", quote: "you always skip Mondays", why: "x" }] },
    });
    expect(await judgeBrief(p, brief, facts)).toEqual([]);
  });

  it("matches quotes despite bold markers and curly quotes", async () => {
    const p = judging({
      ok: true,
      data: { violations: [{ rule: "overclaim", quote: "Book all 7 sessions.", why: "x" }] },
    });
    expect(await judgeBrief(p, brief, facts)).toHaveLength(1);
  });

  it("ignores an overclaim that is just their real record", async () => {
    const p = judging({
      ok: true,
      data: { violations: [{ rule: "overclaim", quote: "you trained 4.3 days a week", why: "x" }] },
    });
    expect(await judgeBrief(p, brief, facts)).toEqual([]);
  });

  it("never blocks a brief when the judge fails", async () => {
    expect(await judgeBrief(judging({ ok: false, error: "down" }), brief, facts)).toEqual([]);
    expect(await judgeBrief(judging(new Error("network")), brief, facts)).toEqual([]);
  });
});
