import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/platform/auth/session";
import { EmptyState } from "@/platform/ui/EmptyState";
import { getOrCreateWeeklyReview, getRecommendationsForCurrentReview } from "@/domains/review/service";
import { ApproveBriefButton } from "./ApproveBriefButton";

const SEVERITY_STYLES: Record<string, string> = {
  low: "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  high: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
};

const STATUS_LABELS: Record<string, string> = {
  ahead: "Ahead",
  on_track: "On track",
  at_risk: "At risk",
  insufficient_data: "Not enough data",
};

export default async function BriefPage() {
  const user = await requireUser();
  const review = await getOrCreateWeeklyReview(user.id);

  if (!review.brief) {
    redirect("/review");
  }
  const brief = review.brief;

  if (review.status === "approved") {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
        <Link href="/dashboard" className="text-sm text-neutral-500 hover:underline">
          ← Back to dashboard
        </Link>
        <EmptyState
          title="This week's plan is active"
          description="Your meal plan, grocery list, and prep plan have been regenerated for the new week."
          action={
            <Link href="/plan" className="text-sm underline">
              Go to plan
            </Link>
          }
        />
      </div>
    );
  }

  const recommendations = await getRecommendationsForCurrentReview(user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <div>
        <Link href="/review" className="text-sm text-neutral-500 hover:underline">
          ← Back to review
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Weekly Operating Brief</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{brief.executiveSummary}</p>
      </div>

      <section>
        <h2 className="text-sm font-medium text-neutral-500">Goal progress</h2>
        <div className="mt-2 space-y-2">
          {brief.progress.map((p, i) => (
            <div key={i} className="rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <span className="font-medium">{STATUS_LABELS[p.status] ?? p.status}</span>
              </div>
              <p className="mt-1 text-neutral-600 dark:text-neutral-400">{p.summary}</p>
              {p.evidence.length > 0 ? (
                <ul className="mt-1 list-disc pl-5 text-xs text-neutral-500">
                  {p.evidence.map((e, j) => (
                    <li key={j}>{e}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-500">Top priorities</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
          {brief.priorities.map((p, i) => (
            <li key={i}>
              <span className="font-medium">{p.title}</span> — {p.reason}
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-lg border border-neutral-900 bg-neutral-900 p-4 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900">
        <p className="text-xs uppercase tracking-wide opacity-70">Highest-leverage action</p>
        <p className="mt-1 text-lg font-medium">{brief.highestLeverageAction}</p>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <section>
          <h2 className="text-sm font-medium text-neutral-500">What worked</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {brief.whatWorked.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="text-sm font-medium text-neutral-500">What needs improvement</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {brief.whatNeedsImprovement.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </section>
      </div>

      {brief.risks.length > 0 ? (
        <section>
          <h2 className="text-sm font-medium text-neutral-500">Risks</h2>
          <div className="mt-2 space-y-2">
            {brief.risks.map((r, i) => (
              <div key={i} className="rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800">
                <div className="flex items-center justify-between">
                  <span>{r.description}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${SEVERITY_STYLES[r.severity]}`}>
                    {r.severity}
                  </span>
                </div>
                <p className="mt-1 text-neutral-600 dark:text-neutral-400">{r.mitigation}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <ApproveBriefButton userId={user.id} recommendations={recommendations} />
    </div>
  );
}
