import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/platform/auth/session";
import { createClient } from "@/platform/supabase/server";
import { getOrCreateWeeklyReview } from "@/domains/review/service";

const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function ReviewPage() {
  const user = await requireUser();
  const review = await getOrCreateWeeklyReview(user.id);

  if (review.brief) {
    redirect("/review/brief");
  }

  const m = review.metrics;

  // No manual "generate" trigger anywhere (web or mobile) — the weekly
  // cron (app/api/cron/generate-weekly-reviews) is the only thing that
  // generates a brief, on the user's own weekly_review_day. Just tell
  // them which day that is.
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("weekly_review_day")
    .eq("id", user.id)
    .maybeSingle();
  const reviewDayLabel =
    profile?.weekly_review_day !== null && profile?.weekly_review_day !== undefined
      ? WEEKDAY_LABELS[profile.weekly_review_day]
      : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <div>
        <Link href="/dashboard" className="text-sm text-neutral-500 hover:underline">
          ← Back to dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Weekly review</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Week of {review.weekStart} through today.
        </p>
      </div>

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
              <dd>{m.averageSleepMinutes !== null ? `${Math.round(m.averageSleepMinutes / 60 * 10) / 10}h` : "No data"}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Task completion</dt>
              <dd>{m.taskCompletionPercent !== null ? `${m.taskCompletionPercent}%` : "No data"}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Pain trend</dt>
              <dd className="capitalize">
                {m.painTrend.replace("_", " ")}
                {m.averagePainThisWeek !== null ? ` (avg ${m.averagePainThisWeek})` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Swelling trend</dt>
              <dd className="capitalize">
                {m.swellingTrend.replace("_", " ")}
                {m.averageSwellingThisWeek !== null ? ` (avg ${m.averageSwellingThisWeek})` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">Learning</dt>
              <dd>{m.learningMinutes} min</dd>
            </div>
          </dl>
          {m.missedTaskReasons.length > 0 ? (
            <p className="mt-3 text-xs text-neutral-500">
              Missed-task reasons: {m.missedTaskReasons.join(", ")}
            </p>
          ) : null}
          {m.isDataSparse ? (
            <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Not much was logged this week — treat adherence numbers above as rough, not precise.
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-lg border border-dashed border-neutral-300 p-4 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
        <p>
          Areta uses what it has learned about you over time, along with the metrics above, to
          write next week&apos;s plan.
        </p>
        <p className="mt-2">
          {reviewDayLabel
            ? `Your weekly brief generates automatically every ${reviewDayLabel} — check back then.`
            : "Your weekly brief generates automatically on your weekly review day (set in Settings)."}
        </p>
      </section>
    </div>
  );
}
