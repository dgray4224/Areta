import { z } from "zod";
import type { AIProvider } from "@/platform/ai/provider";
import type { WeeklyBrief } from "@/domains/review/brief-schema";

/**
 * A second reader for the rules that are about meaning, not wording.
 *
 * brief-check.ts catches what text patterns can: field names, app
 * wording, targets below the plan, repeats. Three rules kept slipping
 * past it in new words every run (2026-09-27): telling someone why their
 * training dropped ("a choice you can flip", "the gap isn't ability"),
 * claiming they have already done a plan their record never reached
 * ("close to a full week" for 4.3 of 7), and inventing a habit from one
 * week ("the one you always drop first"). The first can genuinely hurt
 * someone recovering from an injury, so these get a small, fast model
 * reading the brief the way a person would.
 *
 * Every violation must quote the brief exactly, and a quote that isn't
 * in the brief is thrown away, so the judge can't invent problems.
 */

export type JudgeFacts = {
  plannedSessions: number;
  bestStretchDaysPerWeek: number | null;
  bestStretchReachesPlan: boolean | null;
  /** Consecutive weeks the plan was missed, this week included. */
  missedWeeksInARow: number;
  /** The person's own words this week; a reason they gave may be used. */
  interviewAnswers: Record<string, string>;
};

const verdictSchema = z.object({
  violations: z.array(
    z.object({
      rule: z.enum(["cause", "overclaim", "habit"]),
      quote: z.string(),
      why: z.string(),
    })
  ),
});

const JUDGE_INSTRUCTIONS = `You check a weekly fitness coaching message for three specific mistakes. You
do not judge tone, style, accuracy of other numbers, or anything else. Motivational,
blunt and demanding language is intended and fine.

1. cause — the message claims or implies WHY their training dropped or why they missed
   sessions: that it was a choice, a lack of will, not about ability or capability,
   that their body is fine or capable, that nothing changed. The coach cannot know
   this; there may be an injury, illness or life event. Saying WHAT happened is fine,
   and so is urging them to act. Exception: a reason the person gave themselves in
   interviewAnswers may be repeated.
2. overclaim — the message says or implies they have already trained more often than
   facts.bestStretchDaysPerWeek, or have done or come close to the plan when
   facts.bestStretchReachesPlan is not true. Any description of their past that
   inflates it counts: "close to a full week", "almost the whole plan", "almost every
   day", "nearly daily", "you know what seven days looks like". Saying they have done
   far more than this week, or quoting their best stretch as it is, is fine: a sentence
   that states facts.bestStretchDaysPerWeek itself is never an overclaim.
3. habit — the message claims a repeated pattern in which specific days or sessions
   they miss ("always", "keep missing", "the one you drop first", "keep sliding"). Only
   this week's missed days are known. A claim that the plan was missed several weeks
   running is fine only if facts.missedWeeksInARow is at least that many.

Report only clear violations. For each, quote the exact words from the message
(verbatim, a short phrase is enough) and say in one sentence what is wrong. An empty
list is the expected answer for a good message.`;

function briefText(brief: WeeklyBrief): string {
  return [
    ...brief.narrative,
    ...brief.priorities.flatMap((p) => [p.title, p.reason]),
    ...brief.changes.map((c) => c.reason),
    brief.highestLeverageAction,
  ].join("\n\n");
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[*_"“”‘’']/g, "").replace(/\s+/g, " ").trim();
}

const RULE_FIX: Record<z.infer<typeof verdictSchema>["violations"][number]["rule"], string> = {
  cause: "claims to know why they trained less. Say what happened and what to do, never why.",
  overclaim: "claims they have done or nearly done the plan. Their best stretch proves they can do far more than this week, not that they have done the plan.",
  habit: "claims a habit the data doesn't show. Only this week's missed days are known.",
};

/** Problems in the same plain-language form as findBriefViolations, or
 * an empty list when the judge finds none or can't run — it never blocks
 * a brief. */
export async function judgeBrief(provider: AIProvider, brief: WeeklyBrief, facts: JudgeFacts): Promise<string[]> {
  const text = briefText(brief);
  const result = await provider
    .generateStructured({
      instructions: JUDGE_INSTRUCTIONS,
      context: { message: text, facts },
      schema: verdictSchema,
      tier: "fast",
    })
    .catch(() => null);
  if (!result?.ok) return [];

  const haystack = normalize(text);
  const record = facts.bestStretchDaysPerWeek === null ? null : String(facts.bestStretchDaysPerWeek);
  return result.data.violations
    .filter((v) => v.quote.trim().length > 0 && haystack.includes(normalize(v.quote)))
    // Quoting their real record is the point, not an overclaim; the judge
    // flagged "4.3 days a week for nearly a month" in a preview run.
    .filter((v) => !(v.rule === "overclaim" && record !== null && v.quote.includes(record)))
    .map((v) => `"${v.quote.trim()}" ${RULE_FIX[v.rule]}`);
}
