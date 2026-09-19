import { STALE_AFTER_DAYS } from "@/domains/observability/ai-health";

/**
 * The Monday operator report: is it working, and is anyone using it.
 *
 * Deliberately not a dashboard. It is a page of text that arrives whether
 * or not anyone remembers to look, because the failure this exists to
 * prevent (2026-08-23 to 2026-09-19, the weekly brief writing nothing for
 * four weeks) was invisible precisely because seeing it required someone
 * to go looking.
 *
 * Shape mirrors `weekly_usage_report(p_since, p_until)` in
 * supabase/migrations — keep the two in sync.
 */

export type UsageReport = {
  window: { since: string; until: string };
  users: {
    total: number;
    onboarded: number;
    stalled_in_onboarding: number;
    new_this_week: number;
    onboarded_this_week: number;
  };
  engagement: { active_this_week: number; active_prior_week: number; retained: number };
  loop: {
    briefs_generated: number;
    briefs_approved: number;
    meals_planned: number;
    meals_ticked: number;
    workouts_planned: number;
    workouts_completed: number;
    meal_swaps: number;
    offplan_logs: number;
    quick_estimates: number;
  };
  data_in: { users_syncing: number; health_rows: number; push_tokens: number };
  system: {
    ai_runs: number;
    ai_failures: number;
    insights_created: number;
    last_brief_success: string | null;
    last_insight_created: string | null;
    last_workout_plan_created: string | null;
    last_meal_plan_created: string | null;
  };
};

export type Concern = { label: string; detail: string };

const DAY_MS = 86_400_000;

/**
 * Only jobs whose silence actually means failure. Each is scheduled and
 * must produce output every cycle, so nothing arriving is a problem.
 *
 * Two outputs are deliberately NOT judged this way, because for them an
 * empty week is a correct answer and flagging it would train the reader
 * to ignore the report (found 2026-09-19, the day after this was written:
 * the insight engine was flagged as stale, and running it returned
 * `checked: 13, created: 0, failures: []` — working exactly as designed):
 *
 *   - Insights are gated on data availability and deduplicated, so a
 *     fortnight of nothing new to say is ordinary.
 *   - Meal plans have no scheduled job at all; regenerate-meal-plans is
 *     not in vercel.json. They are generated on demand by onboarding and
 *     the weekly approve flow.
 *
 * Both still appear in the report as plain numbers. They just aren't
 * called problems. The gap this leaves is real and recorded below: with
 * no per-run record, a job that produces nothing legitimately is
 * indistinguishable from one that never ran.
 */
const MUST_PRODUCE_BUDGET_DAYS: Record<string, number> = {
  // Daily cron; each user is due one on their own review day.
  "Weekly brief": STALE_AFTER_DAYS,
  // Weekly cron, Mondays 06:00 UTC.
  "Workout plans": 14,
};

function daysSince(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  return Math.round(((now.getTime() - new Date(iso).getTime()) / DAY_MS) * 10) / 10;
}

function pct(part: number, whole: number): string {
  if (whole === 0) return "n/a";
  return `${Math.round((part / whole) * 100)}%`;
}

function ago(iso: string | null, now: Date): string {
  const d = daysSince(iso, now);
  if (d === null) return "never";
  if (d < 1) return "today";
  return `${d} days ago`;
}

/**
 * What in this report deserves attention. Separated from rendering so the
 * judgement is testable and so the same list can head both the email and
 * an alert.
 */
export function findConcerns(report: UsageReport, now = new Date()): Concern[] {
  const concerns: Concern[] = [];
  const { loop, system, engagement, users } = report;

  for (const [label, iso] of [
    ["Weekly brief", system.last_brief_success],
    ["Workout plans", system.last_workout_plan_created],
  ] as const) {
    const d = daysSince(iso, now);
    const budget = MUST_PRODUCE_BUDGET_DAYS[label];
    if (d === null) {
      concerns.push({ label, detail: "has never produced anything" });
    } else if (d > budget) {
      concerns.push({ label, detail: `last produced anything ${d} days ago, past its ${budget}-day budget` });
    }
  }

  if (system.ai_runs > 0 && system.ai_failures === system.ai_runs) {
    concerns.push({ label: "AI runs", detail: `all ${system.ai_runs} failed this week` });
  }

  // Planned but never touched is the clearest signal that the plan is not
  // reaching anyone, which is the product's whole proposition.
  if (loop.workouts_planned > 0 && loop.workouts_completed === 0) {
    concerns.push({ label: "Workouts", detail: `${loop.workouts_planned} planned, none marked done` });
  }
  if (loop.meals_planned > 0 && loop.meals_ticked === 0) {
    concerns.push({ label: "Meals", detail: `${loop.meals_planned} planned, none ticked` });
  }
  if (users.onboarded > 0 && engagement.active_this_week === 0) {
    concerns.push({ label: "Engagement", detail: "no user did anything at all this week" });
  }

  return concerns;
}

function line(label: string, value: string): string {
  return `${label.padEnd(26, " ")} ${value}`;
}

/** Plain text, because it reads the same in an email, a Slack message and
 * a log line, and needs no template engine to maintain. */
export function renderReport(report: UsageReport, now = new Date()): { subject: string; body: string } {
  const { users, engagement, loop, data_in, system } = report;
  const concerns = findConcerns(report, now);
  const since = report.window.since.slice(0, 10);
  const until = report.window.until.slice(0, 10);

  const subject = concerns.length
    ? `Areta weekly: ${concerns.length} thing${concerns.length === 1 ? "" : "s"} to look at`
    : "Areta weekly: all clear";

  const sections: string[] = [];

  sections.push(`Areta — week of ${since} to ${until}`);

  sections.push(
    concerns.length
      ? ["NEEDS ATTENTION", ...concerns.map((c) => `  • ${c.label}: ${c.detail}`)].join("\n")
      : "NEEDS ATTENTION\n  • Nothing. Every job produced output and the loop is being used."
  );

  sections.push(
    [
      "PEOPLE",
      line("  Total accounts", String(users.total)),
      line("  Onboarded", String(users.onboarded)),
      line("  Stalled in onboarding", String(users.stalled_in_onboarding)),
      line("  New this week", String(users.new_this_week)),
      line("  Finished onboarding", String(users.onboarded_this_week)),
    ].join("\n")
  );

  sections.push(
    [
      "ENGAGEMENT",
      line("  Active this week", String(engagement.active_this_week)),
      line("  Active last week", String(engagement.active_prior_week)),
      line("  Active both weeks", `${engagement.retained} (${pct(engagement.retained, engagement.active_prior_week)} of last week)`),
    ].join("\n")
  );

  sections.push(
    [
      "THE LOOP",
      line("  Briefs written", String(loop.briefs_generated)),
      line("  Briefs approved", String(loop.briefs_approved)),
      line("  Meals planned", String(loop.meals_planned)),
      line("  Meals ticked", `${loop.meals_ticked} (${pct(loop.meals_ticked, loop.meals_planned)})`),
      line("  Workouts planned", String(loop.workouts_planned)),
      line("  Workouts done", `${loop.workouts_completed} (${pct(loop.workouts_completed, loop.workouts_planned)})`),
      line("  Meal swaps", String(loop.meal_swaps)),
      line("  Off-plan food logs", String(loop.offplan_logs)),
      line("  ...of those, quick", String(loop.quick_estimates)),
    ].join("\n")
  );

  sections.push(
    [
      "DATA COMING IN",
      line("  Users syncing Health", String(data_in.users_syncing)),
      line("  Health rows written", String(data_in.health_rows)),
      line("  Devices with push", String(data_in.push_tokens)),
    ].join("\n")
  );

  sections.push(
    [
      "SYSTEM",
      line("  AI runs", `${system.ai_runs} (${system.ai_failures} failed)`),
      line("  Insights created", String(system.insights_created)),
      line("  Last brief", ago(system.last_brief_success, now)),
      line("  Last insight", ago(system.last_insight_created, now)),
      line("  Last workout plan", ago(system.last_workout_plan_created, now)),
      line("  Last meal plan", ago(system.last_meal_plan_created, now)),
    ].join("\n")
  );

  return { subject, body: sections.join("\n\n") };
}
