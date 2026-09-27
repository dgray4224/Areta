import type { AIProvider } from "@/platform/ai/provider";
import { weeklyBriefSchema, type WeeklyBrief } from "@/domains/review/brief-schema";

/**
 * A code check on the model's brief, run before it is saved.
 *
 * Some prompt rules the model kept breaking run after run however they
 * were worded (2026-09-27 preview rounds): internal field names, app
 * mechanics ("logged", "assumed"), explaining its own rules to the
 * person, inventing a habit from one week, and quietly shrinking the plan
 * ("pick your three days" against a 7-session plan). Each is cheap to
 * detect in text, so a violation earns a rewrite (up to two) with the problems
 * named, and the draft with fewer problems is kept.
 */

export type BriefCheckFacts = {
  /** Planned sessions this week; 0 when there is no plan. */
  workoutsPlanned: number;
  /** trainingBaseline.bestStretchReachesPlan. When false, "you've done
   * this plan before" is untrue however it's phrased. */
  bestStretchReachesPlan?: boolean | null;
  /** Last week's narrative and action, so a brief can't repeat itself
   * Sunday after Sunday. */
  lastBriefText?: string[];
};

/** Eight-word runs shared with last week's brief read as a template.
 * Runs made mostly of weekday names, or containing a number, are allowed:
 * the same days can slip and the same record can be cited two weeks in a
 * row. */
const SHINGLE_WORDS = 8;
const WEEKDAY = /^(sunday|monday|tuesday|wednesday|thursday|friday|saturday|and)$/;

function shingles(text: string): Set<string> {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + SHINGLE_WORDS <= words.length; i++) {
    const run = words.slice(i, i + SHINGLE_WORDS);
    if (run.filter((w) => WEEKDAY.test(w)).length >= 3) continue;
    // Facts may repeat week to week ("4.3 days a week"); phrasing may not.
    if (run.some((w) => /\d/.test(w))) continue;
    out.add(run.join(" "));
  }
  return out;
}

function openingWords(text: string, n: number): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean).slice(0, n).join(" ");
}

/** Twice the prompt's "about five" budget: only a clearly stat-heavy
 * narrative earns a rewrite. */
const MAX_NARRATIVE_NUMBERS = 10;

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
};

/** Legitimate mixed-case words that would otherwise read as camelCase. */
const MIXED_CASE_ALLOWED = new Set(["iPhone", "iPad", "iOS", "eBay"]);

const RULES: { pattern: RegExp; problem: string }[] = [
  {
    pattern: /\b(logged|logging|auto-?detected|auto-?completed|assumed|unconfirmed|synced|ticked|not visible|isn't visible|aren't visible)\b/i,
    problem: "describes how data reached the app. Say what happened in their life, or leave it out.",
  },
  {
    pattern: /\b(adherence score|score of \d+|data[- ]quality|plan[- ]design|execution gap)\b/i,
    problem: "uses internal jargon. Say it in everyday words.",
  },
  {
    pattern: /\b(enough to change|enough weeks|weeks in a row for|not a plan problem|plan (didn't|did not|hasn't|has not|doesn't|does not) (change|need to change|need changing)|doesn't need to change|plan itself (is|was|isn't|wasn't) (wrong|the (issue|problem))|sign the plan (itself )?is wrong)\b/i,
    problem: "explains your own rules or why you are or aren't changing the plan. Just coach.",
  },
  {
    pattern: /\b(keep|kept|keeps) (missing|losing|skipping|slipping)\b|\b(usually|always) (miss|skip|lose)\b/i,
    problem: "claims a habit the data doesn't show (there is one week of missed days). Describe this week only.",
  },
  {
    pattern: /\b(isn't|is not|wasn't|was not) about (capacity|ability|capability)\b|\ba choice, not\b|\b(it's|it is|that's|that is|was) (a|your) choice\b|\b(gap|problem|issue) (isn't|is not|wasn't|was not) (about )?(ability|capacity|your body)\b|\bbody (that's|that is|is) (clearly |fully )?capable\b|\bpurely (about|a matter of|down to)\b|\bbody can(not|'t|) handle\b|\bnothing (here )?saying your body\b|\bnothing (physically |really )?changed\b|\bjust a (choice|decision)\b|\bonly (thing|difference) (is|was) (the )?(choice|decision|you)\b/i,
    problem: "claims to know why their training dropped. You can't see injuries, illness or life events; describe what changed, never why.",
  },
  {
    pattern: /\b(he|she|he's|she's|him|his|hers|herself|himself)\b/i,
    problem: "describes them in the third person or assumes their pronoun. Speak to them as \"you\".",
  },
  {
    pattern: /\b(doubled?|doubling|tripled?|tripling|quadrupled?|twice (as|the)|half (as|of what))\b/i,
    problem: "turns a comparison into a ratio, which is arithmetic. Give both numbers instead.",
  },
  {
    pattern: /!/,
    problem: "uses an exclamation mark.",
  },
];

function userFacingText(brief: WeeklyBrief): { where: string; text: string }[] {
  return [
    ...brief.narrative.map((text, i) => ({ where: `narrative paragraph ${i + 1}`, text })),
    ...brief.priorities.flatMap((p, i) => [
      { where: `priority ${i + 1} title`, text: p.title },
      { where: `priority ${i + 1} reason`, text: p.reason },
    ]),
    ...brief.changes.flatMap((c, i) => [
      { where: `change ${i + 1} label`, text: c.field },
      { where: `change ${i + 1} reason`, text: c.reason },
    ]),
    { where: "highestLeverageAction", text: brief.highestLeverageAction },
  ];
}

function excerpt(text: string, index: number): string {
  const start = Math.max(0, index - 30);
  return `"…${text.slice(start, index + 40).trim()}…"`;
}

/**
 * A training target below the plan, in the parts of the brief that tell
 * the person what to do. Statements about what happened ("you did 3 of
 * your 7") are allowed; asks ("pick your three days", "4-5 days next
 * week") are not.
 */
function findTargetsBelowPlan(text: string, planned: number): number | null {
  const re = /(?<![\d.])\b(\d+|one|two|three|four|five|six)(?:\s*(?:-|–|to|or)\s*(\d+|one|two|three|four|five|six|seven))?\s+(?:training\s+|planned\s+|fixed\s+)?(days|sessions|workouts|slots)\b(?!\s+(of|out of))/gi;
  for (const match of text.matchAll(re)) {
    const before = text.slice(Math.max(0, match.index - 25), match.index).toLowerCase();
    if (/\b(did|trained|completed|finished|managed|only|you hit|of your|remaining|missed|other|was|were|held|averaged)\b/.test(before)) continue;
    const after = text.slice(match.index + match[0].length, match.index + match[0].length + 25).toLowerCase();
    if (/^\s*(you |that |which )?(have |had |already )?(missed|slipped|skipped|got away|you did)/.test(after)) continue;
    const high = match[2] ?? match[1];
    const value = NUMBER_WORDS[high.toLowerCase()] ?? Number(high);
    if (value < planned) return match.index;
  }
  return null;
}

/** Plain-language problems to hand back to the model; empty when clean. */
export function findBriefViolations(brief: WeeklyBrief, facts: BriefCheckFacts): string[] {
  const problems: string[] = [];

  for (const { where, text } of userFacingText(brief)) {
    const identifier = [...text.matchAll(/\b[a-z]+[A-Z][A-Za-z]*\b|\b[a-z]+_[a-z_]+\b/g)].find(
      (m) => !MIXED_CASE_ALLOWED.has(m[0])
    );
    if (identifier) {
      problems.push(`${where} uses the internal name "${identifier[0]}". Say what it means in everyday words.`);
    }
    for (const rule of RULES) {
      const m = rule.pattern.exec(text);
      if (m) problems.push(`${where} ${excerpt(text, m.index)} ${rule.problem}`);
    }
  }

  // A "change" that keeps things as they are still shows up as a button
  // to accept or reject, and explains the rules while it's at it.
  brief.changes.forEach((c, i) => {
    const same = c.previousValue !== null && String(c.previousValue).trim() === String(c.proposedValue).trim();
    const saysKept = /\b(kept|keep|as[- ]is|unchanged|no change|stays? the same)\b/i.test(String(c.proposedValue));
    if (same || saysKept) {
      problems.push(`change ${i + 1} doesn't change anything. Leave it out; an empty changes list is fine.`);
    }
  });

  // A narrative crowded with numbers reads as a report, not a coach.
  const numbers = brief.narrative.join(" ").match(/\d+(?:[.,]\d+)?/g) ?? [];
  if (numbers.length > MAX_NARRATIVE_NUMBERS) {
    problems.push(
      `the narrative uses ${numbers.length} numbers and reads like a report. Keep about five that drive the story and turn the rest into motivation.`
    );
  }

  if (facts.bestStretchReachesPlan === false) {
    const all = userFacingText(brief).map((t) => t.text).join(" ");
    const m = /\b(proven what (a full|seven|\d+)|know what (a full week|seven days|\d+ days) looks like|runs? it again|know how to (run|do|train) (a|the) full|(already|you've) (done|run|hit|held|trained) (a full week|the (full )?plan|this plan|all \d+|every day)|(above|beyond|past) that pace|exactly what (this|the) plan (is )?ask)/i.exec(all);
    if (m) {
      problems.push(
        `${excerpt(all, m.index)} claims they have already done the plan. Their best stretch is below it: it proves they can do far more than this week, not that they have done the plan.`
      );
    }
  }

  if (facts.lastBriefText && facts.lastBriefText.length > 0) {
    const last = facts.lastBriefText.join(" ");
    // Two words: "Three sessions again" after "Three sessions out of seven"
    // still reads as the same opening.
    if (openingWords(brief.narrative[0], 2) === openingWords(facts.lastBriefText[0], 2)) {
      problems.push("the narrative opens the same way as last week's brief. Open differently.");
    }
    const lastShingles = shingles(last);
    const repeated = [...shingles(userFacingText(brief).map((t) => t.text).join(" "))].find((sh) => lastShingles.has(sh));
    if (repeated) {
      problems.push(`"${repeated}" repeats a line from last week's brief. Say it a new way.`);
    }
  }

  if (facts.workoutsPlanned > 0) {
    const asks = [
      ...brief.priorities.map((p, i) => ({ where: `priority ${i + 1}`, text: `${p.title}. ${p.reason}` })),
      { where: "highestLeverageAction", text: brief.highestLeverageAction },
    ];
    for (const { where, text } of asks) {
      const index = findTargetsBelowPlan(text, facts.workoutsPlanned);
      if (index !== null) {
        problems.push(
          `${where} ${excerpt(text, index)} sets a training target below the plan. The plan is ${facts.workoutsPlanned} sessions; every training ask covers all ${facts.workoutsPlanned}.`
        );
      }
    }
  }

  return problems;
}

/** At most three model calls per brief, and only when a draft fails. */
const MAX_REWRITES = 2;

const REVISION_INSTRUCTIONS = `

REVISION. The context includes previousDraft, a brief you already wrote, and
problemsToFix, the specific rules it broke. Rewrite the brief fixing every one of those
problems. Keep everything else that was good about it: the same insight, facts and
structure unless a problem requires changing them.`;

export type CheckedBriefResult =
  | { ok: true; data: WeeklyBrief; revised: boolean; remainingProblems: string[] }
  | { ok: false; error: string };

/**
 * Generates the brief, checks it, and if anything is wrong asks for up to
 * two rewrites with the problems named. Keeps whichever draft has the
 * fewest problems — a rewrite can fail validation or introduce new
 * trouble.
 */
export async function generateCheckedBrief(
  provider: AIProvider,
  instructions: string,
  context: Record<string, unknown>,
  facts: BriefCheckFacts,
  /** Extra reader for rules about meaning (brief-judge.ts); its problems
   * join the pattern check's. */
  judge?: (brief: WeeklyBrief) => Promise<string[]>
): Promise<CheckedBriefResult> {
  const check = async (brief: WeeklyBrief) => [
    ...findBriefViolations(brief, facts),
    ...(judge ? await judge(brief) : []),
  ];

  const first = await provider.generateStructured({ instructions, context, schema: weeklyBriefSchema });
  if (!first.ok) return first;

  let best = { data: first.data, problems: await check(first.data), revised: false };
  // A rewrite fixes the named problems but can introduce a new one (a
  // line repeated from last week, say), so it gets a second go.
  for (let attempt = 0; attempt < MAX_REWRITES && best.problems.length > 0; attempt++) {
    const next = await provider.generateStructured({
      instructions: instructions + REVISION_INSTRUCTIONS,
      context: { ...context, previousDraft: best.data, problemsToFix: best.problems },
      schema: weeklyBriefSchema,
    });
    if (!next.ok) break;
    const problems = await check(next.data);
    if (problems.length <= best.problems.length) best = { data: next.data, problems, revised: true };
  }
  return { ok: true, data: best.data, revised: best.revised, remainingProblems: best.problems };
}
