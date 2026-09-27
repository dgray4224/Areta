"use server";

import { createClient } from "@/platform/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";
import { computeWeeklyMetrics, type WeeklyMetrics } from "@/domains/review/metrics";
import type { WeeklyBrief } from "@/domains/review/brief-schema";
import { buildWeeklyReviewContext } from "@/domains/review/context-builder";
import { getRecentMemories, createMemory } from "@/domains/memory/service";
import type { MemoryType } from "@/domains/memory/schema";
import { getAIProvider } from "@/platform/ai/get-provider";
import { computeAndStoreInsights } from "@/domains/insights/service";
import { getApprovedParameterValue } from "@/domains/parameters/service";
import type { TaskStatus } from "@/domains/tasks/schema";
import { reviewWeekStart, reviewWindowFor, todayIso } from "@/domains/review/dates";
import { resolveTimezone } from "@/domains/activity-summary/service";
import { computeMetricCorrelations } from "@/domains/review/correlations";
import { computeAchievements, immediatelyPreviousWeek, type AchievementFacts } from "@/domains/review/achievements";
import { computeGoalTrajectories, type GoalTrajectory, type GoalWithTarget } from "@/domains/review/trajectory";
import { computeStreaks, type StreakFacts } from "@/domains/review/streaks";
import { computePlanExecution } from "@/domains/review/plan-execution";
import { computeTrainingBaseline, BASELINE_WEEKS } from "@/domains/review/training-baseline";
import { addDaysToDateString } from "@/domains/insights/dates";
import { generateCheckedBrief } from "@/domains/review/brief-check";
import { judgeBrief } from "@/domains/review/brief-judge";
import {
  evaluateExperimentOutcomes,
  type ExperimentOutcome,
  type EvaluableRecommendation,
  type ExpectedMetricKey,
  type ExpectedDirection,
} from "@/domains/review/experiments";

const LB_PER_KG = 2.2046226218;

/** How many past weeks' metrics to pull for correlation mining / achievement
 * ranking / goal-trajectory history. ~3 months — enough to find a real
 * pattern without the query growing unbounded for long-tenured users. */
const METRICS_HISTORY_WEEKS = 12;

/** Keys the mobile lightweight interview step (lib/review-screens/
 * InterviewStep.tsx) sends, mapped to the durable-memory type they get
 * promoted as (CLAUDE.md §7 Layer 4) when a brief is generated. Answers
 * with no mapping (an unrecognized key) are ignored rather than guessed
 * at — keep this in sync with the mobile question set. */
const ANSWER_MEMORY_TYPE: Record<string, MemoryType> = {
  wentWell: "successful_strategy",
  difficult: "failed_strategy",
  shouldChange: "preference",
  missedTaskCause: "constraint",
  scheduleChanges: "constraint",
};

const WEEKLY_BRIEF_INSTRUCTIONS = `You are this person's weekly coach. You can see their nutrition, training, movement,
sleep, heart data, recovery, learning and goals side by side. Your job is to tell them
something true and useful about their body and their week that they would not have
worked out themselves, explain what it means for the goal they actually care about, and
tell them what to do about it. The brief is about their life, not about the app: it
should read like a smart coach who studied their week, never like a product reporting
on its own usage. You never calculate
anything — every number in the context below (metrics, correlationFindings,
achievements, goalTrajectories, experimentOutcomes, recentInsights) was
computed by deterministic code and is ground truth. Restate these numbers exactly; never recompute,
round differently, or invent a number that isn't present in the context.

Write for a person, not a database. The context uses internal field names
(proteinAdherencePercent, trainingDays, workoutAdherencePercent, etc.). Those names
must NEVER appear anywhere in your output: not in narrative, priorities, changes (reason
or field), or highestLeverageAction. No camelCase, no snake_case, no "metrics.x". Say
what the number is in everyday words: "you hit 68% of your protein target", "you trained
on 3 days", "about 1,100 steps a day". Same for engine jargon: never say "adherence
score" or quote a bare score ("score 74"), "data-quality issue", "plan-design mismatch",
"auto-detected", "assumed intake" or "logged" — say what actually happened.

Comparisons with past weeks must use the numbers in weeklyMetricsHistory exactly. Never
say a week was "the same as" or "similar to" another unless the numbers are equal.

The plan is the plan. The person built their training plan when they set their goals;
it is their commitment, and your job is to help them keep it, not to renegotiate it.
- Planned sessions they didn't do are an execution gap: say so plainly and without
  softening ("you did 3 of your 7 planned sessions"), then help them close it next week
  with concrete tactics (which days, what time, what to do when a day falls apart).
  Be direct, never scolding or moralizing.
- Training they did is still worth recognizing, but never as proof the plan is too big.
- Do NOT propose reducing training volume (fewer sessions, fewer days, shorter
  sessions) unless planExecution.planChangeWarranted is true. That flag means they have
  missed their plan for planExecution.missedWeeksInARow weeks straight (about a month
  or more). Only then may changes include a lighter plan, and the reason must cite that
  run of weeks, not this week alone. The same holds for lowering calorie or protein
  targets: a missed or unmeasured week is never grounds to lower a goal.

Their own record is your strongest evidence. trainingBaseline holds a year of their
training from their watch: this week, their recent averages, and their best 4-week
stretch (all in training days per week, the same unit as planned sessions).
- When they fell short of the plan, hold this week up against what they have already
  done, and use it as proof the plan is within reach: "3 sessions this week. In March
  you trained 6 days a week for a month straight — you know exactly what 7 looks like."
  Turn dates into plain time ("in March", "about two months ago").
- Say when with bestStretch.when exactly as given; never work out dates yourself.
- Only claim they have done the plan before when bestStretchReachesPlan is true. If
  their best is below the plan, use it as proof they can do far more than this week
  showed — never as a smaller target. The target is always the full plan.
- When this week beats their recent averages, say so: a comeback deserves naming.
- Only call this week their best "in weeks" or "in months" when
  thisWeekMatchesOrBeatsLast12 is true. Otherwise bestWeekLast12 is the recent week to
  chase down, and the full plan is still the target.
- It is a reason to execute the plan, never a reason to add to it.
- If weeksOfHistory is small or bestStretch is null, there is no record yet; skip it.
- If goals, memories or interviewAnswers mention an injury, surgery, illness or
  recovery, do not hold up a stretch from before it as the standard.
- You can see what changed in their training, never why. A drop could be injury,
  illness, surgery, work or family. Never say or imply it was just a choice, that
  nothing physical changed, or that they could have trained. Quote the record exactly
  (4.3 days a week, not "4-5").

Voice. Fired up. This is the one message all week that should make them want to get
up and go. Write like the great motivational coaches talk: borrow their stance and
energy, never their catchphrases or quotes.
- Ownership (Jocko Willink): no excuses, no blame, no cushioning. Name the miss in one
  flat sentence, then pivot hard to what happens next.
- Belief built on evidence (Les Brown, Eric Thomas): they are capable of far more than
  this week showed, and their own record proves it. Make them feel it. Urgency: this
  week, starting now, not someday.
- Standards and identity (Tony Robbins): speak to who they are becoming. They set this
  plan; that is the standard, and they are someone who keeps their word to themselves.
- The next step is small and immediate (Mel Robbins): something they can start today,
  without waiting to feel ready.
- Discipline compounds (Jim Rohn): every session they keep is a brick. Stack them.
How it sounds: short, punchy sentences. Fragments are fine. Rhythm and repetition for
emphasis ("You did it in December. You did it for a month straight. You can do it
again."). Direct challenge in second person. Open paragraph 1 with a line that hits, and
end the narrative on a charge, not a summary. Real fire in several lines, not just one,
but every claim still earned by the data: hype on made-up facts is worthless. No
exclamation marks (the energy comes from the words), no cheesy hype words ("crush it",
"beast mode", "let's go"), no quotes (the quote lives in weeklyMottoId only). Never
frame pushing through pain or injury as toughness.

What makes a brief worth reading (spend nearly all of it here):
- Meaning, not recap. Every number you mention should come with what it means for their
  goal: is it on pace, what is it costing or buying them, what is likely driving it.
- Connections. The best insight links two things (training and sleep, protein and
  recovery, steps and weight trend, this week vs their own last few weeks).
- Their body. Resting heart rate, HRV, VO2 max, sleep and training load say something
  about fitness, recovery and stress; interpret them against their own history when it
  exists, in plain language, without diagnosing anything.
- Concrete next moves in the real world: what to eat, when to train, how to structure
  the week. Priorities and highestLeverageAction are things to do in their life, never
  actions inside the app (no "confirm meals", "tick workouts", "open the app",
  "log more"). The one exception: stepping on a scale, since weight is the only way to
  see a weight goal move.
- App mechanics are background, not content. Do not narrate how data got into the app
  (auto-completed, synced, ticked, confirmed), logging streaks, or which records are
  inferred. Use that knowledge silently to decide how confident to be. If a gap truly
  prevents judging their goal, say so in at most one short plain sentence and move on.

Output format — narrative: 3 short paragraphs, no bullet lists, no headers. This is a
pep talk from a coach who studied their week, not a report. Every paragraph should
move them; data is the ammunition, not the point.
- Paragraph 1, the truth. Open with a line that hits. Then the one fact about this week
  that matters most for their goal, said straight, tied to the goal in their own words
  (the goal outcome text). Pick it from the strongest real thing you have: a comeback
  against their own record, a missed plan, a recentInsight (keep its numbers verbatim),
  a correlation (|r| >= 0.5), a goalTrajectory change, an experimentOutcome (verbatim
  per its classification). Wrap the one standout number in **bold**.
- Paragraph 2, the proof. Why they can do what the plan asks: their own record
  (trainingBaseline, achievements), what worked this week, their own words from
  interviewAnswers. This is where belief comes from, so make it land.
- Paragraph 3, the charge. What this week demands of them and why it matters to who
  they are becoming. End on a line that makes them want to get up and go.
- Number budget: about five numbers in the whole narrative. Use only the ones that
  drive the story. Steps, heart rate, HRV, VO2 max and sleep appear only when they
  change what they should do this week; otherwise leave them out. Never a paragraph of
  stats.
- *Italics* sparingly, for one line that deserves it.

Never sound like a template. lastWeeksBrief is what you told them last Sunday: do not
reuse its opening, its metaphors or its signature lines. Vary how you open week to week
(a challenge, a question, a callback to their record, a blunt fact, one word) and
reach for fresh images rather than the same ones. The coaches' ideas are a stance, not
stock phrases: don't lean on "brick", "stack", "standard" or the tone example's wording
every week.

Only say they have done the plan before when trainingBaseline.bestStretchReachesPlan is
true. When it is false, their best stretch proves they can do far more than this week,
not that they have done the plan or "know how to run a full week".

Tone example. This is a DIFFERENT person with made-up numbers — never reuse its facts,
numbers or sentences, only its energy and rhythm:
  "Two sessions. That's what the week got out of you, and you know it's not who you
  are. Your goal is to run a half marathon in March, and it doesn't get closer on the
  days you don't lace up. / In June you ran four days a week for six weeks straight.
  Not once. Six weeks. That runner didn't go anywhere. / Four runs are on the plan.
  Tuesday is the first one. Be the person who keeps their word to themselves."
- Weight is slow-moving: never judge it by the single week. When
  metrics.weightChangeSinceStartLb or metrics.weightChange12WeekLb is present, frame
  this week's weight inside that longer arc (restating those numbers exactly), and
  treat the weekly delta as noise unless the longer trend agrees with it.
- Distinguish missed execution, outcome issues, and missing data in how you frame
  things. Missed planned sessions are execution, per the plan-is-the-plan rules above.
  Where the metrics point at something outside their control (injury, pain, illness in
  interviewAnswers), say so instead. If metrics.isDataSparse is true, say plainly there isn't
  enough logged this week to draw a real conclusion, rather than forcing an insight
  from thin data.
- Training, steps and heart data come from their watch or phone: treat them as facts
  about what happened, the same standing as weight. metrics.workoutsPlanned and
  metrics.workoutsCompleted are sessions (training days), not exercises.
- Never ask someone to log what the phone already supplies, and never call a week empty
  because of missing taps. If trainingDays or averageDailySteps is present, the week is
  not empty — say what the movement shows. Do not ask for more logging at all, except
  weighing in when a weight goal has no recent weight.
- When metrics.intakeVisible is false you cannot see what they ate this week: calorie
  and protein figures are withheld on purpose. Do not discuss intake adherence at all
  beyond, at most, one short clause; build the brief on training, steps, weight and body
  data instead. Never guess what they ate.
- metrics.mealsSkipped is them saying a meal did not happen;
  help them plan around the slot they keep skipping rather than dropping it.
- Only use facts that are in the context. Never infer a pattern (a meal they "tend to
  skip", a day they "usually miss") that no number in the context shows.
- achievements describe the current week unless they name a different weekStart.
  personalBestAdherenceScore and adherenceScore jumps are internal composites: never
  quote the number. Say what it means ("your most consistent week so far").
- The rules in these instructions are yours, not theirs. Never explain them, cite
  thresholds, or say why you are or aren't suggesting something ("you haven't missed
  enough weeks to change the plan"). Just coach.
- Any numbers you combine must add up. If the plan has 7 sessions and they did 3, the
  gap is 4.
- Hold the line on the plan. Every training priority and highestLeverageAction asks for
  all planned sessions — never "3 days", "4-5 days", "one more session" or any other
  number below the plan, and never a stepping-stone target.
- Planned sessions already sit on fixed days; metrics.missedWorkoutDays names the ones
  that slipped. Coach them to protect those days (a set time, a fallback for when the
  day goes sideways). Never tell them to pick new days or fewer days.
- Be honest, not falsely encouraging. If they missed their plan, say so plainly. Never manufacture praise, and never compare the user to anyone but
  their own history.
- Never invent medical advice or recovery progression. Do not suggest changes to brace
  settings, weight-bearing status, exercise intensity, running, jumping, return to sport,
  or medication — that is exclusively a clinician's call.

highestLeverageAction: one bolded, concrete, single sentence — the one thing to actually
do this week about the narrative's insight. Must add something new, not restate the
narrative's last sentence. May use **bold**/*italic* the same way.

priorities: at most 3, ranked 1-3, each tied to a specific goal or domain — these become
next week's suggested commitments, so keep each one a single concrete, checkable thing.

changes: proposed changes to their plan or targets — never to app behavior such as
prompts, reminders or logging, and never a reduction in volume or targets unless
planExecution.planChangeWarranted is true (see "The plan is the plan"). An empty list is
a perfectly good answer. Never list a change that keeps something as it is. Each grounded in metrics/memory/experimentOutcomes.
field is shown to the person as a button label: a short plain-English name of what
changes, 2-5 words, sentence case (e.g. "Training days per week", "Protein target").
reason is shown too, so write it in plain words like the narrative. Describe changes qualitatively — deterministic code
recalculates exact numeric targets separately. For each change, also state expectedMetric
(one of: weightChangeLb, averageWeightThisWeek, proteinAdherencePercent,
calorieAdherencePercent, averageSleepMinutes, taskCompletionPercent, learningMinutes,
workoutAdherencePercent, trainingMinutes, trainingDays, averageDailySteps,
averagePainThisWeek, averageSwellingThisWeek) and expectedDirection — this turns the
change into a falsifiable one-week hypothesis that next week's brief will check against
the real measured outcome. Pick the metric this change is actually meant to move, not an
arbitrary one.

weeklyMottoId: pick from motivationQuoteBank whose themes best match this user's real
priorities or struggles this week. Never invent a quote or use one outside the bank.`;

export type WeeklyReviewView = {
  id: string;
  weekStart: string;
  status: "draft" | "answered" | "generated" | "approved";
  metrics: WeeklyMetrics | null;
  brief: WeeklyBrief | null;
  answers: Record<string, string>;
};

async function fetchMetrics(
  userId: string,
  weekStart: string,
  weekEnd: string,
  client?: SupabaseClient<Database>
): Promise<WeeklyMetrics> {
  const supabase = client ?? (await createClient());
  const [
    { data: weightLogsRaw },
    { data: sleepLogs },
    { data: restingHeartRateLogs },
    { data: heartRateVariabilityLogs },
    { data: vo2MaxLogs },
    { data: nutritionLogs },
    { data: recoveryLogs },
    { data: studySessions },
    { data: tasks },
    { data: recordedWorkouts },
    { data: plannedWorkoutRows },
    { data: dailySummaries },
    { data: plannedMealRows },
    calorieTarget,
    proteinTarget,
  ] = await Promise.all([
    supabase
      .from("health_metrics")
      .select("started_at, value, unit")
      .eq("user_id", userId)
      .eq("metric_type", "weight")
      .gte("started_at", `${weekStart}T00:00:00.000Z`)
      .lte("started_at", `${weekEnd}T23:59:59.999Z`),
    supabase
      .from("health_metrics")
      .select("value")
      .eq("user_id", userId)
      .eq("metric_type", "sleep")
      .gte("started_at", `${weekStart}T00:00:00.000Z`)
      .lte("started_at", `${weekEnd}T23:59:59.999Z`),
    // Phase 4 of the enhancement roadmap (2026-08-13) -- the three
    // vitals CANDIDATE_PAIRS in domains/review/correlations.ts actually
    // reference. Same query shape as the sleep query above, one per type.
    supabase
      .from("health_metrics")
      .select("value")
      .eq("user_id", userId)
      .eq("metric_type", "resting_heart_rate")
      .gte("started_at", `${weekStart}T00:00:00.000Z`)
      .lte("started_at", `${weekEnd}T23:59:59.999Z`),
    supabase
      .from("health_metrics")
      .select("value")
      .eq("user_id", userId)
      .eq("metric_type", "heart_rate_variability")
      .gte("started_at", `${weekStart}T00:00:00.000Z`)
      .lte("started_at", `${weekEnd}T23:59:59.999Z`),
    supabase
      .from("health_metrics")
      .select("value")
      .eq("user_id", userId)
      .eq("metric_type", "vo2_max")
      .gte("started_at", `${weekStart}T00:00:00.000Z`)
      .lte("started_at", `${weekEnd}T23:59:59.999Z`),
    supabase
      .from("nutrition_logs")
      .select("date, calories, protein")
      .eq("user_id", userId)
      .gte("date", weekStart)
      .lte("date", weekEnd),
    supabase
      .from("recovery_logs")
      .select("date, pain, swelling")
      .eq("user_id", userId)
      .gte("date", weekStart)
      .lte("date", weekEnd)
      .order("date", { ascending: true }),
    supabase
      .from("study_sessions")
      .select("duration_minutes")
      .eq("user_id", userId)
      .gte("date", weekStart)
      .lte("date", weekEnd),
    supabase
      .from("daily_actions")
      .select("status, skip_reason")
      .eq("user_id", userId)
      .gte("date", weekStart)
      .lte("date", weekEnd),
    // Training, added 2026-09-19. Until then the brief had no training
    // input at all — not zero, absent — so a coach whose whole job is
    // rewriting your training week could only ever comment on food
    // logging. These three are the passive side of that: what Health
    // recorded, what the plan asked for, and how much the person moved.
    supabase
      .from("health_metrics")
      .select("started_at, ended_at")
      .eq("user_id", userId)
      .eq("metric_type", "workout")
      .gte("started_at", `${weekStart}T00:00:00.000Z`)
      .lte("started_at", `${weekEnd}T23:59:59.999Z`),
    supabase
      .from("workout_plan_items")
      .select("day_of_week, completed_at, completed_source, workout_plans!inner(week_start, status)")
      .eq("user_id", userId)
      .eq("workout_plans.week_start", weekStart)
      .eq("workout_plans.status", "active"),
    supabase
      .from("activity_daily_summaries")
      .select("day, steps_total")
      .eq("user_id", userId)
      .gte("day", weekStart)
      .lte("day", weekEnd),
    supabase
      .from("meal_plan_items")
      .select("completed_at, completed_source, skipped_at, meal_plans!inner(week_start, status)")
      .eq("user_id", userId)
      .eq("meal_plans.week_start", weekStart)
      .eq("meal_plans.status", "active"),
    getApprovedParameterValue(userId, "nutrition", "calorie_target", supabase),
    getApprovedParameterValue(userId, "nutrition", "protein_target_g", supabase),
  ]);

  const weightLogs = (weightLogsRaw ?? []).map((w) => ({
    loggedAt: w.started_at,
    weight: w.unit === "kg" ? Number(w.value) * LB_PER_KG : Number(w.value),
  }));

  // Long-horizon weight anchors (see WeeklyMetricsInput.baselineWeight).
  // Baseline waits on profiles.created_at, so these two run after the
  // batch above; both are limit(1) index hits.
  const { data: profileRow } = await supabase.from("profiles").select("created_at").eq("id", userId).maybeSingle();
  const accountStart = profileRow?.created_at ?? null;
  const twelveWeeksAgoIso = new Date(
    new Date(`${weekStart}T00:00:00.000Z`).getTime() - 84 * 24 * 60 * 60 * 1000
  ).toISOString();
  const [{ data: baselineRow }, { data: twelveWeekRow }] = await Promise.all([
    accountStart
      ? supabase
          .from("health_metrics")
          .select("started_at, value, unit")
          .eq("user_id", userId)
          .eq("metric_type", "weight")
          .gte("started_at", accountStart)
          .order("started_at", { ascending: true })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("health_metrics")
      .select("started_at, value, unit")
      .eq("user_id", userId)
      .eq("metric_type", "weight")
      .lte("started_at", twelveWeeksAgoIso)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const toWeightAnchor = (row: { started_at: string; value: number | null; unit: string | null } | null) =>
    row && row.value != null
      ? { loggedAt: row.started_at, weight: row.unit === "kg" ? Number(row.value) * LB_PER_KG : Number(row.value) }
      : null;

  return computeWeeklyMetrics({
    weekStart,
    weightLogs,
    baselineWeight: toWeightAnchor(baselineRow),
    weightTwelveWeeksAgo: toWeightAnchor(twelveWeekRow),
    sleepLogs: (sleepLogs ?? []).map((s) => ({ totalDurationMinutes: s.value != null ? Number(s.value) : null })),
    restingHeartRateLogs: (restingHeartRateLogs ?? []).map((r) => ({ value: r.value != null ? Number(r.value) : null })),
    heartRateVariabilityLogs: (heartRateVariabilityLogs ?? []).map((r) => ({
      value: r.value != null ? Number(r.value) : null,
    })),
    vo2MaxLogs: (vo2MaxLogs ?? []).map((r) => ({ value: r.value != null ? Number(r.value) : null })),
    nutritionLogs: (nutritionLogs ?? []).map((n) => ({
      date: n.date,
      calories: n.calories,
      protein: n.protein,
    })),
    recoveryLogs: (recoveryLogs ?? []).map((r) => ({
      date: r.date,
      pain: r.pain,
      swelling: r.swelling,
    })),
    studySessions: (studySessions ?? []).map((s) => ({ durationMinutes: s.duration_minutes })),
    recordedWorkouts: (recordedWorkouts ?? [])
      .filter((w) => w.ended_at !== null)
      .map((w) => ({
        date: w.started_at.slice(0, 10),
        durationMinutes: Math.round(
          (new Date(w.ended_at as string).getTime() - new Date(w.started_at).getTime()) / 60000
        ),
      })),
    plannedWorkouts: (plannedWorkoutRows ?? []).map((w) => ({
      dayOfWeek: w.day_of_week,
      completedAt: w.completed_at,
      completedSource: w.completed_source,
    })),
    stepDays: (dailySummaries ?? []).map((d) => ({ date: d.day, steps: d.steps_total })),
    plannedMeals: (plannedMealRows ?? []).map((m) => ({
      completedAt: m.completed_at,
      completedSource: m.completed_source,
      skippedAt: m.skipped_at,
    })),
    tasks: (tasks ?? []).map((t) => ({
      status: t.status as TaskStatus,
      skipReason: t.skip_reason,
    })),
    calorieTarget,
    proteinTarget,
  });
}

export async function getOrCreateWeeklyReview(
  userId: string,
  client?: SupabaseClient<Database>
): Promise<WeeklyReviewView> {
  const supabase = client ?? (await createClient());
  const weekStart = await reviewWeekStart(supabase, userId);

  const { data: existing } = await supabase
    .from("weekly_reviews")
    .select("*")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (existing) {
    return {
      id: existing.id,
      weekStart: existing.week_start,
      status: existing.status as WeeklyReviewView["status"],
      metrics: existing.metrics as WeeklyMetrics,
      brief: existing.brief as WeeklyBrief | null,
      answers: (existing.answers as Record<string, string> | null) ?? {},
    };
  }

  // The completed week this cycle reports on, not "up to today" -- see
  // reviewWindowFor. Fixed for the whole cycle, so the figures never
  // drift out from under the narrative written against them.
  const window = reviewWindowFor(weekStart);
  const metrics = await fetchMetrics(userId, window.start, window.end, supabase);
  const { data: created, error } = await supabase
    .from("weekly_reviews")
    .insert({ user_id: userId, week_start: weekStart, metrics, status: "draft" })
    .select("*")
    .single();

  if (error?.code === "23505") {
    // Lost a create race against another concurrent call for the same
    // user+week (getReviewSummaryBundle fans out getOrCreateWeeklyReview
    // and getReviewFactsBundle — which itself calls getOrCreateWeeklyReview
    // — in the same Promise.all; on a week with no row yet, both read
    // "nothing exists" before either has inserted). The other call won;
    // fetch what it created instead of failing the whole request.
    const { data: winner, error: refetchError } = await supabase
      .from("weekly_reviews")
      .select("*")
      .eq("user_id", userId)
      .eq("week_start", weekStart)
      .single();
    if (refetchError || !winner) {
      throw new Error(`Failed to create weekly review: ${error.message}`);
    }
    return {
      id: winner.id,
      weekStart: winner.week_start,
      status: winner.status as WeeklyReviewView["status"],
      metrics: winner.metrics as WeeklyMetrics,
      brief: winner.brief as WeeklyBrief | null,
      answers: (winner.answers as Record<string, string> | null) ?? {},
    };
  }

  if (error || !created) {
    throw new Error(`Failed to create weekly review: ${error?.message}`);
  }

  return {
    id: created.id,
    weekStart: created.week_start,
    status: created.status as WeeklyReviewView["status"],
    metrics,
    brief: null,
    answers: {},
  };
}

/**
 * Saves (merges) this week's lightweight-interview answers. Called
 * repeatedly as the mobile interview step's fields lose focus, so
 * partial answers survive the app being backgrounded mid-interview.
 * Ensures a draft weekly_reviews row exists first (a user could open the
 * interview before ever loading the review page).
 */
export async function saveReviewAnswers(
  userId: string,
  answers: Record<string, string>,
  client?: SupabaseClient<Database>
): Promise<ActionResult> {
  const supabase = client ?? (await createClient());
  const weekStart = await reviewWeekStart(supabase, userId);

  const { data: existing } = await supabase
    .from("weekly_reviews")
    .select("id, answers, status")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (!existing) {
    await getOrCreateWeeklyReview(userId, supabase);
  }

  const priorAnswers = (existing?.answers as Record<string, string> | null) ?? {};
  const mergedAnswers = { ...priorAnswers, ...answers };
  // Only "answered" while still a draft — don't downgrade a week that
  // already has a generated/approved brief just because the user tweaked
  // an interview answer afterward.
  const nextStatus = existing?.status === "draft" || !existing ? "answered" : existing.status;

  const { error } = await supabase
    .from("weekly_reviews")
    .update({ answers: mergedAnswers, status: nextStatus })
    .eq("user_id", userId)
    .eq("week_start", weekStart);

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: undefined };
}

export type ReviewFactsBundle = {
  currentPhase: { name: string; mission: string | null } | null;
  activeGoals: {
    id: string;
    outcome: string;
    domain: string;
    targetDate: string | null;
    priority: number | null;
    targetMetricType: GoalWithTarget["targetMetricType"];
    targetValue: number | null;
    targetDirection: GoalWithTarget["targetDirection"];
    baselineValue: number | null;
    baselineRecordedAt: string | null;
  }[];
  nutritionTargets: {
    calorieTarget: number | null;
    proteinTarget: number | null;
    expectedWeeklyRateLb: number | null;
  } | null;
  recentMemories: { type: string; content: string; evidence: string | null }[];
  previousWeekPriorities: string[];
  weeklyMetricsHistory: { weekStart: string; metrics: WeeklyMetrics }[];
  correlationFindings: ReturnType<typeof computeMetricCorrelations>;
  achievements: AchievementFacts;
  goalTrajectories: GoalTrajectory[];
  streaks: StreakFacts;
  experimentOutcomes: ExperimentOutcome[];
};

/**
 * Computes every deterministic (non-AI) fact the weekly-review engine
 * needs — shared by `generateWeeklyBrief` (which feeds this into the AI
 * context) and `getReviewFactsBundle` (a plain read for the mobile
 * Streaks/Vitals/Plan-Recap tabs, so they work even before a brief is
 * generated, without duplicating this ~80 lines of query/computation
 * logic in two places). `persistExperimentOutcomes` is true only from
 * the generation path — a read endpoint shouldn't have write
 * side-effects, even idempotent ones.
 */
async function computeReviewFacts(
  supabase: SupabaseClient<Database>,
  userId: string,
  weekStart: string,
  today: string,
  timezone: string,
  currentMetrics: WeeklyMetrics,
  persistExperimentOutcomes: boolean
): Promise<ReviewFactsBundle> {
  const [
    { data: phases },
    { data: goalsRaw },
    { data: previousReviewRow },
    { data: metricsHistoryRaw },
    recentMemories,
    expectedWeeklyRateLb,
    calorieTarget,
    proteinTarget,
    streaks,
  ] = await Promise.all([
    supabase.from("phases").select("name, mission").eq("user_id", userId).eq("is_current", true).limit(1),
    supabase
      .from("goals")
      .select(
        "id, outcome, target_date, priority, domains(key), target_metric_type, target_value, target_direction, baseline_value, baseline_recorded_at"
      )
      .eq("user_id", userId)
      .eq("status", "active"),
    supabase
      .from("weekly_reviews")
      .select("id, metrics, brief")
      .eq("user_id", userId)
      .lt("week_start", weekStart)
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("weekly_reviews")
      .select("week_start, metrics")
      .eq("user_id", userId)
      .lt("week_start", weekStart)
      .order("week_start", { ascending: false })
      .limit(METRICS_HISTORY_WEEKS),
    getRecentMemories(userId, 20, supabase),
    getApprovedParameterValue(userId, "nutrition", "expected_weekly_rate_lb", supabase),
    getApprovedParameterValue(userId, "nutrition", "calorie_target", supabase),
    getApprovedParameterValue(userId, "nutrition", "protein_target_g", supabase),
    computeStreaks(supabase, userId, timezone, today),
  ]);

  const previousBrief = previousReviewRow?.brief as WeeklyBrief | null;
  // Rows from before reviews reported on the completed week (see
  // reviewWindowFor) hold a partial snapshot of the same days this week
  // covers. Left in, the brief compares the week against a half-finished
  // copy of itself and reports the difference as progress.
  const weeklyMetricsHistory = (metricsHistoryRaw ?? [])
    .map((row) => ({ weekStart: row.week_start, metrics: row.metrics as WeeklyMetrics }))
    .filter((row) => row.metrics.weekStart < currentMetrics.weekStart);
  const previousWeekMetrics = immediatelyPreviousWeek(currentMetrics, weeklyMetricsHistory);

  // Full history for correlation/trajectory analysis includes the current
  // (just-computed) week alongside the past ones fetched above.
  const historyIncludingCurrent = [{ weekStart, metrics: currentMetrics }, ...weeklyMetricsHistory];

  const correlationFindings = computeMetricCorrelations(historyIncludingCurrent);
  const achievements: AchievementFacts = computeAchievements(
    currentMetrics,
    weeklyMetricsHistory,
    previousWeekMetrics,
    streaks as StreakFacts
  );

  const goalsWithTargets: GoalWithTarget[] = (goalsRaw ?? []).map((g) => ({
    id: g.id,
    targetMetricType: g.target_metric_type as GoalWithTarget["targetMetricType"],
    targetValue: g.target_value,
    targetDirection: g.target_direction as GoalWithTarget["targetDirection"],
    targetDate: g.target_date,
    baselineValue: g.baseline_value,
    baselineRecordedAt: g.baseline_recorded_at,
  }));
  const goalTrajectories: GoalTrajectory[] = computeGoalTrajectories(goalsWithTargets, historyIncludingCurrent);

  // Closed-loop experiment evaluation: did last week's accepted,
  // hypothesis-bearing recommendations actually move the metric they
  // named? Only possible once there's a previous week to compare against.
  let experimentOutcomes: ExperimentOutcome[] = [];
  if (previousReviewRow) {
    const { data: previousRecommendationsRaw } = await supabase
      .from("recommendations")
      .select("id, field, accepted, expected_metric, expected_direction")
      .eq("weekly_review_id", previousReviewRow.id);

    const previousRecommendations: EvaluableRecommendation[] = (previousRecommendationsRaw ?? []).map((r) => ({
      id: r.id,
      field: r.field,
      accepted: r.accepted,
      expectedMetric: r.expected_metric as ExpectedMetricKey | null,
      expectedDirection: r.expected_direction as ExpectedDirection | null,
    }));

    experimentOutcomes = evaluateExperimentOutcomes(
      { metrics: previousReviewRow.metrics as WeeklyMetrics, recommendations: previousRecommendations },
      currentMetrics
    );

    if (persistExperimentOutcomes) {
      // Persist the evaluation back onto last week's rows — best-effort,
      // this is the only point both before/after values are available.
      try {
        await Promise.all(
          experimentOutcomes.map((o) =>
            supabase
              .from("recommendations")
              .update({
                outcome_classification: o.classification,
                outcome_metric_before: o.before,
                outcome_metric_after: o.after,
                evaluated_at: new Date().toISOString(),
              })
              .eq("id", o.recommendationId)
          )
        );
      } catch {
        // Non-fatal — the outcomes still reach the caller below.
      }
    }
  }

  return {
    currentPhase: phases && phases.length > 0 ? { name: phases[0].name, mission: phases[0].mission } : null,
    activeGoals: (goalsRaw ?? []).map((g) => ({
      id: g.id,
      outcome: g.outcome,
      domain: (g.domains as unknown as { key: string } | null)?.key ?? "general",
      targetDate: g.target_date,
      priority: g.priority,
      targetMetricType: g.target_metric_type as GoalWithTarget["targetMetricType"],
      targetValue: g.target_value,
      targetDirection: g.target_direction as GoalWithTarget["targetDirection"],
      baselineValue: g.baseline_value,
      baselineRecordedAt: g.baseline_recorded_at,
    })),
    nutritionTargets:
      calorieTarget || proteinTarget ? { calorieTarget, proteinTarget, expectedWeeklyRateLb } : null,
    recentMemories: recentMemories.map((m) => ({
      type: m.type,
      content: m.content,
      evidence: m.evidence,
    })),
    previousWeekPriorities: previousBrief?.priorities.map((p) => p.title) ?? [],
    weeklyMetricsHistory,
    correlationFindings,
    achievements,
    goalTrajectories,
    streaks: streaks as StreakFacts,
    experimentOutcomes,
  };
}

/**
 * Plain read of this week's deterministic facts bundle — no AI call, no
 * writes. Powers the mobile Plan-Recap/Vitals/Streaks tabs, which should
 * work even before the user has generated (or without ever generating)
 * an AI brief for the week.
 */
export async function getReviewFactsBundle(
  userId: string,
  client?: SupabaseClient<Database>
): Promise<ReviewFactsBundle> {
  const supabase = client ?? (await createClient());
  const weekStart = await reviewWeekStart(supabase, userId);
  const today = await todayIso(supabase, userId);
  const timezone = await resolveTimezone(supabase, userId);
  const review = await getOrCreateWeeklyReview(userId, supabase);
  return computeReviewFacts(
    supabase,
    userId,
    weekStart,
    today,
    timezone,
    review.metrics as WeeklyMetrics,
    false
  );
}

export async function generateWeeklyBrief(
  userId: string,
  client?: SupabaseClient<Database>
): Promise<ActionResult> {
  const supabase = client ?? (await createClient());
  const weekStart = await reviewWeekStart(supabase, userId);
  const today = await todayIso(supabase, userId);
  const timezone = await resolveTimezone(supabase, userId);

  const { data: review } = await supabase
    .from("weekly_reviews")
    .select("*")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (!review) {
    return { ok: false, error: "Open the review page before generating a brief." };
  }

  const currentMetrics = review.metrics as WeeklyMetrics;

  // Give the brief something from the user's own history to talk about
  // before writing it. Both read imported HealthKit data that was
  // otherwise only reached by a daily cron. Here rather than in
  // ensureWeeklyBrief so the Sunday cron gets it too — that path called
  // this function directly and skipped it, so a new user's first
  // scheduled brief had none of their past in it. Neither may block the
  // brief: one about this week alone beats none.
  await Promise.allSettled([
    ensureHistoricalWeeksBackfilled(userId, supabase),
    ensureInsightsExist(userId, supabase),
  ]);

  const facts = await computeReviewFacts(supabase, userId, weekStart, today, timezone, currentMetrics, true);

  // The last brief actually written (backfilled weeks have none), so this
  // one can't open or phrase things the same way two Sundays running.
  const { data: lastBriefRow } = await supabase
    .from("weekly_reviews")
    .select("brief")
    .eq("user_id", userId)
    .lt("week_start", weekStart)
    .not("brief", "is", null)
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastBrief = (lastBriefRow?.brief as WeeklyBrief | null) ?? null;

  // A year of the person's own training, straight from imported history,
  // as the yardstick for this week (domains/review/training-baseline.ts).
  const { data: baselineDays } = await supabase
    .from("activity_daily_summaries")
    .select("day, workout_total_minutes, steps_total")
    .eq("user_id", userId)
    .gte("day", addDaysToDateString(currentMetrics.weekStart, -7 * BASELINE_WEEKS))
    .lte("day", addDaysToDateString(currentMetrics.weekStart, 6));
  const trainingBaseline = computeTrainingBaseline(
    currentMetrics.weekStart,
    (baselineDays ?? []).map((d) => ({
      date: d.day,
      workoutMinutes: d.workout_total_minutes ?? 0,
      steps: d.steps_total ?? 0,
    })),
    currentMetrics.workoutsPlanned
  );

  // This week's Insight Engine v2 findings (Phase 3, 2026-08-14) — the
  // generate-insights cron runs 30 minutes before this one (vercel.json),
  // so on the user's review day fresh pattern insights already exist by
  // the time the brief generates. Dismissed insights are excluded: the
  // user said "not interesting", the narrative shouldn't resurface them.
  const { data: recentInsightRows } = await supabase
    .from("insights")
    .select("type, headline")
    .eq("user_id", userId)
    .neq("status", "dismissed")
    .gte("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString())
    .order("score", { ascending: false })
    .limit(5);

  const context = buildWeeklyReviewContext({
    weekStart,
    currentPhase: facts.currentPhase,
    activeGoals: facts.activeGoals,
    metrics: currentMetrics,
    nutritionTargets: facts.nutritionTargets,
    recentMemories: facts.recentMemories,
    previousWeekPriorities: facts.previousWeekPriorities,
    weeklyMetricsHistory: facts.weeklyMetricsHistory,
    correlationFindings: facts.correlationFindings,
    achievements: facts.achievements,
    goalTrajectories: facts.goalTrajectories,
    streaks: facts.streaks,
    experimentOutcomes: facts.experimentOutcomes,
    planExecution: computePlanExecution([{ weekStart, metrics: currentMetrics }, ...facts.weeklyMetricsHistory]),
    trainingBaseline,
    lastWeeksBrief: lastBrief
      ? { narrative: lastBrief.narrative, highestLeverageAction: lastBrief.highestLeverageAction }
      : null,
    recentInsights: recentInsightRows ?? [],
    interviewAnswers: (review.answers as Record<string, string> | null) ?? {},
  });

  const provider = getAIProvider();
  const result = await generateCheckedBrief(
    provider,
    WEEKLY_BRIEF_INSTRUCTIONS,
    context as unknown as Record<string, unknown>,
    {
      workoutsPlanned: currentMetrics.workoutsPlanned,
      bestStretchReachesPlan: trainingBaseline.bestStretchReachesPlan,
      lastBriefText: lastBrief ? [...lastBrief.narrative, lastBrief.highestLeverageAction] : [],
    },
    (brief) =>
      judgeBrief(provider, brief, {
        plannedSessions: currentMetrics.workoutsPlanned,
        bestStretchDaysPerWeek: trainingBaseline.bestStretch?.averageDaysPerWeek ?? null,
        bestStretchReachesPlan: trainingBaseline.bestStretchReachesPlan,
        missedWeeksInARow: context.planExecution.missedWeeksInARow,
        interviewAnswers: context.interviewAnswers,
      })
  );
  if (result.ok && result.remainingProblems.length > 0) {
    console.warn(`[review] brief for ${userId} kept after check with: ${result.remainingProblems.join(" | ")}`);
  }

  await supabase.from("ai_runs").insert({
    user_id: userId,
    purpose: "weekly_brief",
    model: "claude-sonnet-5",
    success: result.ok,
    error: result.ok ? null : result.error,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const { error } = await supabase
    .from("weekly_reviews")
    .update({ brief: result.data, status: "generated" })
    .eq("user_id", userId)
    .eq("week_start", weekStart);

  if (error) {
    return { ok: false, error: error.message };
  }

  await supabase.from("recommendations").delete().eq("weekly_review_id", review.id);
  if (result.data.changes.length > 0) {
    await supabase.from("recommendations").insert(
      result.data.changes.map((c) => ({
        user_id: userId,
        weekly_review_id: review.id,
        field: c.field,
        previous_value: c.previousValue,
        proposed_value: c.proposedValue,
        reason: c.reason,
        confidence: c.confidence,
        expected_metric: c.expectedMetric ?? null,
        expected_direction: c.expectedDirection ?? null,
      }))
    );
  }

  // Promote this week's interview answers into durable memory (CLAUDE.md
  // §7 Layer 4) as unconfirmed facts — best-effort, never blocks the
  // brief itself. There's no confirm/review UI yet, so these accumulate
  // with user_confirmed: false (the `memories` table's default) until one
  // exists.
  for (const [key, value] of Object.entries(context.interviewAnswers)) {
    if (!value || !value.trim()) continue;
    const memoryType = ANSWER_MEMORY_TYPE[key];
    if (!memoryType) continue;
    try {
      await createMemory(
        userId,
        {
          type: memoryType,
          content: value.trim(),
          evidence: `Weekly review interview, week of ${weekStart}`,
          confidence: 0.5,
        },
        supabase
      );
    } catch {
      // Non-fatal.
    }
  }

  return { ok: true, data: undefined };
}

export type RecommendationView = {
  id: string;
  field: string;
  previousValue: string | number | null;
  proposedValue: string | number | null;
  reason: string;
  confidence: number | null;
  accepted: boolean | null;
  expectedMetric: string | null;
  expectedDirection: string | null;
  outcomeClassification: string | null;
  outcomeMetricBefore: number | null;
  outcomeMetricAfter: number | null;
};

export async function getRecommendationsForCurrentReview(
  userId: string,
  client?: SupabaseClient<Database>
): Promise<RecommendationView[]> {
  const supabase = client ?? (await createClient());
  const weekStart = await reviewWeekStart(supabase, userId);

  const { data: review } = await supabase
    .from("weekly_reviews")
    .select("id")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (!review) return [];

  const { data, error } = await supabase
    .from("recommendations")
    .select(
      "id, field, previous_value, proposed_value, reason, confidence, accepted, expected_metric, expected_direction, outcome_classification, outcome_metric_before, outcome_metric_after"
    )
    .eq("weekly_review_id", review.id);

  if (error) {
    throw new Error(`Failed to load recommendations: ${error.message}`);
  }

  return (data ?? []).map((r) => ({
    id: r.id,
    field: r.field,
    previousValue: r.previous_value as string | number | null,
    proposedValue: r.proposed_value as string | number | null,
    reason: r.reason,
    confidence: r.confidence,
    accepted: r.accepted,
    expectedMetric: r.expected_metric,
    expectedDirection: r.expected_direction,
    outcomeClassification: r.outcome_classification,
    outcomeMetricBefore: r.outcome_metric_before,
    outcomeMetricAfter: r.outcome_metric_after,
  }));
}

export type ReviewSummaryBundle = {
  weekStart: string;
  status: WeeklyReviewView["status"];
  /** Why `brief` is null, when it is. "pending" means one is being
   * written now (the route kicks generation off in the background);
   * "unavailable" means this cycle's attempts are spent and the client
   * should stop promising one rather than spin forever. */
  briefStatus: "ready" | "pending" | "unavailable";
  metrics: WeeklyMetrics | null;
  brief: WeeklyBrief | null;
  answers: Record<string, string>;
  recommendations: RecommendationView[];
  previousWeekMetrics: WeeklyMetrics | null;
  achievements: AchievementFacts;
  goalTrajectories: GoalTrajectory[];
  /** Goal outcome text + target/baseline fields, so mobile's standalone
   * trajectory card (independent of whether a brief exists) has an
   * outcome to attach each trajectory to, and a "Set a target" CTA for
   * goals with none — web's own /goals page already gets this from
   * getReviewFactsBundle directly; this is the mobile-bearer-route
   * equivalent. */
  activeGoals: ReviewFactsBundle["activeGoals"];
  streaks: StreakFacts;
  correlationFindings: ReviewFactsBundle["correlationFindings"];
  experimentOutcomes: ExperimentOutcome[];
};

/** Everything the Review tab's sub-tabs need in one round trip — shared by
 * the mobile bearer route (app/api/review/route.ts) and the web app's own
 * /review pages, so the two never assemble this bundle two different ways.
 * Read-only: getReviewFactsBundle recomputes the deterministic facts fresh
 * (cheap — pure queries/math, no AI call), so this works whether or not a
 * brief has been generated yet this week. */
/** Automatic generation attempts allowed per review cycle, counting the
 * cron's. Bounds the cost of a user who reopens the tab all week while
 * something is persistently failing, but still lets a transient failure
 * recover without waiting seven days for the next cron. */
const MAX_BRIEF_ATTEMPTS_PER_CYCLE = 3;

export type EnsureBriefOutcome = "ready" | "generated" | "failed" | "attempts_exhausted";

/**
 * Guarantees the current cycle has a brief, generating one on the spot
 * if it doesn't.
 *
 * The cron used to be the only trigger, which meant a brief existed only
 * if you had been a user on your review day and nothing went wrong that
 * morning. Someone who installed the app on a Wednesday saw a promise
 * about Sunday; someone whose Sunday generation failed saw that same
 * promise for a fortnight. Neither had any way to ask for one.
 *
 * Safe to call on every load: it returns immediately once a brief
 * exists, and caps attempts per cycle so a persistent failure can't turn
 * every app open into a model call.
 */
export async function ensureWeeklyBrief(
  userId: string,
  client?: SupabaseClient<Database>
): Promise<EnsureBriefOutcome> {
  const supabase = client ?? (await createClient());
  const review = await getOrCreateWeeklyReview(userId, supabase);
  if (review.brief) return "ready";

  const { count } = await supabase
    .from("ai_runs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("purpose", "weekly_brief")
    .gte("created_at", `${review.weekStart}T00:00:00.000Z`);

  if ((count ?? 0) >= MAX_BRIEF_ATTEMPTS_PER_CYCLE) return "attempts_exhausted";

  // History backfill and first insights now run inside generateWeeklyBrief.
  const result = await generateWeeklyBrief(userId, supabase);
  return result.ok ? "generated" : "failed";
}

/** How many past weeks to reconstruct from imported history. Matches
 * METRICS_HISTORY_WEEKS — there is no point building weeks the brief's
 * own history query would never read. */
const BACKFILL_WEEKS = METRICS_HISTORY_WEEKS;

/**
 * Reconstructs past weeks' metrics from imported health history, so a
 * brand-new account's first brief has something to compare against.
 *
 * Everything comparative in a brief — weeklyMetricsHistory, the
 * correlations mined from it, achievements, goal trajectories — reads
 * past weekly_reviews rows, which accumulate one per week going
 * forward. Importing ten years of HealthKit data produced none of them,
 * so a new user's history was invisible to the brief no matter how much
 * of it they had. These rows close that gap.
 *
 * They are marked `backfilled` and carry no brief, answers or
 * recommendations: they are weeks that HAPPENED, not weeks that were
 * reviewed, and nothing should present them as the latter.
 *
 * Only weeks with actual imported data become rows — a user with three
 * weeks of history gets three, not twelve empty ones that would poison
 * every correlation with fabricated zeroes.
 */
async function ensureHistoricalWeeksBackfilled(
  userId: string,
  supabase: SupabaseClient<Database>
): Promise<void> {
  try {
    // Once per account, and only for an account that has no history of
    // its own. Checked against the flag rather than a raw row count so
    // re-running is idempotent no matter how many weeks were written.
    const [{ count: reconstructed }, { count: lived }] = await Promise.all([
      supabase
        .from("weekly_reviews")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("backfilled", true),
      supabase
        .from("weekly_reviews")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("backfilled", false),
    ]);
    if ((reconstructed ?? 0) > 0) return;
    // More than the current cycle's own row means real weeks have
    // accumulated, and those are better history than anything
    // reconstructed.
    if ((lived ?? 0) > 1) return;

    const weekStart = await reviewWeekStart(supabase, userId);

    // How far back the imported history actually goes. Without this we'd
    // manufacture empty weeks for someone who joined last Tuesday.
    const { data: earliest } = await supabase
      .from("activity_daily_summaries")
      .select("day")
      .eq("user_id", userId)
      .order("day", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!earliest?.day) return;

    const rows: Database["public"]["Tables"]["weekly_reviews"]["Insert"][] = [];
    for (let i = 1; i <= BACKFILL_WEEKS; i++) {
      const anchor = new Date(`${weekStart}T00:00:00Z`);
      anchor.setUTCDate(anchor.getUTCDate() - 7 * i);
      const past = anchor.toISOString().slice(0, 10);
      const window = reviewWindowFor(past);
      if (window.end < earliest.day) break;

      const metrics = await fetchMetrics(userId, window.start, window.end, supabase);
      // A week the person simply wasn't wearing the phone tells the
      // correlation miner nothing, and a run of fabricated zeroes would
      // actively mislead it.
      if (metrics.isDataSparse) continue;

      rows.push({
        user_id: userId,
        week_start: past,
        metrics: metrics as unknown as Database["public"]["Tables"]["weekly_reviews"]["Insert"]["metrics"],
        status: "draft",
        backfilled: true,
      });
    }

    if (rows.length === 0) return;

    // Ignores anything that already exists on (user_id, week_start) --
    // a real reviewed week always wins over a reconstructed one.
    const { error } = await supabase
      .from("weekly_reviews")
      .upsert(rows, { onConflict: "user_id,week_start", ignoreDuplicates: true });
    if (error) {
      console.error(`[review] historical week backfill failed for ${userId}: ${error.message}`);
    }
  } catch (error) {
    console.error(`[review] historical week backfill failed for ${userId}:`, error);
  }
}

/**
 * Runs the insight engine on demand for a user who has none.
 *
 * computeAndStoreInsights reads activity_daily_summaries and
 * health_metrics — the imported history — but until now the daily cron
 * was its only caller anywhere in the codebase, so a user who had just
 * imported ten years of HealthKit data waited up to 24 hours before
 * anything looked at it. Only fires when the user has no insights at
 * all, so it's a one-off for new accounts rather than a second engine
 * running beside the cron.
 */
async function ensureInsightsExist(userId: string, supabase: SupabaseClient<Database>): Promise<void> {
  const { count } = await supabase
    .from("insights")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if ((count ?? 0) > 0) return;

  try {
    // Pattern scans are the expensive part and the reason this is worth
    // doing at all -- they are what find something in years of history.
    await computeAndStoreInsights(userId, supabase, { includePatternScans: true });
  } catch (error) {
    console.error(`[review] on-demand insight generation failed for ${userId}:`, error);
  }
}

export async function getReviewSummaryBundle(
  userId: string,
  client?: SupabaseClient<Database>
): Promise<ReviewSummaryBundle> {
  const supabase = client ?? (await createClient());

  const [review, recommendations, facts] = await Promise.all([
    getOrCreateWeeklyReview(userId, supabase),
    getRecommendationsForCurrentReview(userId, supabase),
    getReviewFactsBundle(userId, supabase),
  ]);

  // Lets the client distinguish "your brief is being written right now"
  // from "we tried and it isn't coming" -- previously both looked like
  // an indefinite promise that one would arrive on your review day.
  let briefStatus: "ready" | "pending" | "unavailable" = "ready";
  if (!review.brief) {
    const { count } = await supabase
      .from("ai_runs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("purpose", "weekly_brief")
      .gte("created_at", `${review.weekStart}T00:00:00.000Z`);
    briefStatus = (count ?? 0) >= MAX_BRIEF_ATTEMPTS_PER_CYCLE ? "unavailable" : "pending";
  }

  return {
    weekStart: review.weekStart,
    status: review.status,
    briefStatus,
    metrics: review.metrics,
    brief: review.brief,
    answers: review.answers,
    recommendations,
    previousWeekMetrics: review.metrics ? immediatelyPreviousWeek(review.metrics, facts.weeklyMetricsHistory) : null,
    achievements: facts.achievements,
    goalTrajectories: facts.goalTrajectories,
    activeGoals: facts.activeGoals,
    streaks: facts.streaks,
    correlationFindings: facts.correlationFindings,
    experimentOutcomes: facts.experimentOutcomes,
  };
}
