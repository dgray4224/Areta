import Link from "next/link";
import { getOrCreateWeeklyReview, getRecommendationsForCurrentReview, getReviewFactsBundle } from "@/domains/review/service";
import { getWeeklyOutcomesCheckIn } from "@/domains/weeklyoutcomes/service";
import { createClient } from "@/platform/supabase/server";
import { EmptyState } from "@/platform/ui/EmptyState";
import { Card } from "@/platform/ui/Card";
import { RichText } from "@/platform/ui/RichText";
import { GoalTrajectoryList } from "./GoalTrajectoryList";
import { InterviewSection } from "./InterviewSection";
import { OutcomesCheckInList } from "./OutcomesCheckInList";
import { ApproveBriefButton } from "./ApproveBriefButton";
import type { WeeklyBrief } from "@/domains/review/brief-schema";

const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** A brief stored under the pre-2026-08-12 schema has no `narrative`
 * field (jsonb has no schema migration) — treat it as "not generated in
 * the current format" rather than crash on the old shape. */
function hasCurrentShapeBrief(brief: unknown): brief is WeeklyBrief {
  return !!brief && Array.isArray((brief as { narrative?: unknown }).narrative);
}

/**
 * Review tab's "Insights" sub-tab (replaces the old "Summary" + separate
 * /review/brief route + "Check-in" query-param tab) — the redesigned
 * weekly brief: 2-3 paragraphs of prose (RichText renders the bold/
 * italic markdown-lite subset domains/review/brief-schema.ts's
 * `narrative` field uses) instead of a stitched-together stack of
 * sections, a bolded highest-leverage action, the top goal trajectories,
 * priorities as compact chips, and the weekly-outcomes check-in folded in
 * below rather than its own tab. No more redirect to a separate
 * /review/brief route — brief-or-not renders inline here, matching
 * areta-mobile's Insights.tsx.
 */
export async function Insights({ userId }: { userId: string }) {
  const review = await getOrCreateWeeklyReview(userId);

  if (review.status === "approved") {
    return (
      <EmptyState
        title="This week's plan is active"
        description="Your meal plan, grocery list, and prep plan have been regenerated for the new week."
        action={
          <Link href="/plan" className="text-sm underline">
            Go to plan
          </Link>
        }
      />
    );
  }

  if (review.brief && hasCurrentShapeBrief(review.brief)) {
    const brief = review.brief;
    const [recommendations, facts, outcomes] = await Promise.all([
      getRecommendationsForCurrentReview(userId),
      getReviewFactsBundle(userId),
      getWeeklyOutcomesCheckIn(userId),
    ]);

    return (
      <div className="space-y-6">
        <div className="space-y-3 text-[15px] leading-relaxed text-neutral-800 dark:text-neutral-200">
          {brief.narrative.map((paragraph, i) => (
            <p key={i}>
              <RichText text={paragraph} />
            </p>
          ))}
        </div>

        <Card tone="hero">
          <p className="text-xs uppercase tracking-wide opacity-70">Highest-leverage action</p>
          <p className="mt-1 text-lg font-medium">
            <RichText text={brief.highestLeverageAction} />
          </p>
        </Card>

        {facts.goalTrajectories.length > 0 ? (
          <GoalTrajectoryList goals={facts.activeGoals} trajectories={facts.goalTrajectories} limit={2} />
        ) : null}

        {brief.priorities.length > 0 ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">This week&apos;s focus</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {brief.priorities.map((p, i) => (
                <span
                  key={i}
                  className="rounded-full border border-neutral-300 px-3 py-1.5 text-sm font-medium dark:border-neutral-700"
                >
                  {p.title}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {outcomes.length > 0 ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Last week&apos;s commitments</p>
            <div className="mt-2">
              <OutcomesCheckInList userId={userId} initialOutcomes={outcomes} />
            </div>
          </div>
        ) : null}

        <ApproveBriefButton userId={userId} recommendations={recommendations} />
      </div>
    );
  }

  // No brief yet (or an old-shape one from before this redesign).
  const m = review.metrics;
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("weekly_review_day").eq("id", userId).maybeSingle();
  const reviewDayLabel =
    profile?.weekly_review_day !== null && profile?.weekly_review_day !== undefined
      ? WEEKDAY_LABELS[profile.weekly_review_day]
      : null;

  return (
    <div className="space-y-6">
      {m ? (
        <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="text-sm font-medium text-neutral-500">This week, calculated</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-neutral-500">Weight change</dt>
              <dd>{m.weightChangeLb !== null ? `${m.weightChangeLb} lb` : "No data"}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Avg weight</dt>
              <dd>{m.averageWeightThisWeek !== null ? `${m.averageWeightThisWeek} lb` : "No data"}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Calorie adherence</dt>
              <dd>{m.calorieAdherencePercent !== null ? `${m.calorieAdherencePercent}%` : "No data"}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Protein adherence</dt>
              <dd>{m.proteinAdherencePercent !== null ? `${m.proteinAdherencePercent}%` : "No data"}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Avg sleep</dt>
              <dd>{m.averageSleepMinutes !== null ? `${Math.round((m.averageSleepMinutes / 60) * 10) / 10}h` : "No data"}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Task completion</dt>
              <dd>{m.taskCompletionPercent !== null ? `${m.taskCompletionPercent}%` : "No data"}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Learning</dt>
              <dd>{m.learningMinutes} min</dd>
            </div>
          </dl>
          {m.isDataSparse ? (
            <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Not much was logged this week — treat the numbers above as rough, not precise.
            </p>
          ) : null}
        </section>
      ) : null}

      <InterviewSection userId={userId} initialAnswers={review.answers} missedTaskReasons={m?.missedTaskReasons ?? []} />

      <section className="rounded-lg border border-dashed border-neutral-300 p-4 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
        <p>Areta uses what it has learned about you over time, along with the metrics above, to write next week&apos;s plan.</p>
        <p className="mt-2">
          {reviewDayLabel
            ? `Your weekly brief generates automatically every ${reviewDayLabel} — check back then.`
            : "Your weekly brief generates automatically on your weekly review day (set in Settings)."}
        </p>
      </section>
    </div>
  );
}
