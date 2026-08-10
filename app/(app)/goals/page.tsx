import Link from "next/link";
import { requireUser } from "@/platform/auth/session";
import { EmptyState } from "@/platform/ui/EmptyState";
import { Card } from "@/platform/ui/Card";
import { getActiveGoals } from "@/domains/goals/service";
import { getReviewFactsBundle } from "@/domains/review/service";

const PACE_LABELS: Record<string, string> = {
  ahead: "Ahead of pace",
  on_pace: "On pace",
  behind: "Behind pace",
  insufficient_data: "Not enough data yet",
  not_applicable: "No numeric target set",
};

const PACE_STYLES: Record<string, string> = {
  ahead: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  on_pace: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  behind: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  insufficient_data: "bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
  not_applicable: "bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
};

function formatTargetDate(targetDate: string): string {
  return new Date(`${targetDate}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * The desktop counterpart to areta-mobile's GoalsOverviewModal — every
 * active goal ranked, not just the top-3 slice Dashboard/Plan each show.
 * Goes further than mobile's version since the data already exists on
 * web: each goal's pace-status/weeks-remaining trajectory (computed by
 * the same review-engine-v2 logic the Review tab's Streaks sub-tab
 * already uses, domains/review/trajectory.ts via getReviewFactsBundle)
 * rides along for goals that set a numeric target — mobile only ever
 * shows the outcome text and target date.
 */
export default async function GoalsPage() {
  const user = await requireUser();
  const [goals, facts] = await Promise.all([getActiveGoals(user.id), getReviewFactsBundle(user.id)]);
  const trajectoryByGoal = new Map(facts.goalTrajectories.map((t) => [t.goalId, t]));

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <div>
        <Link href="/dashboard" className="text-sm text-neutral-500 hover:underline">
          ← Back to dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Goals</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Every active goal, ranked by priority.
        </p>
      </div>

      {goals.length === 0 ? (
        <EmptyState
          title="No active goals yet"
          description="Goals are set during onboarding, or from a weekly review's approved priorities."
        />
      ) : (
        <div className="space-y-3">
          {goals.map((goal, index) => {
            const trajectory = trajectoryByGoal.get(goal.id);
            return (
              <Card key={goal.id} tone="surface">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">
                    {index + 1}. {goal.outcome}
                  </p>
                  {trajectory ? (
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${PACE_STYLES[trajectory.paceStatus]}`}>
                      {PACE_LABELS[trajectory.paceStatus] ?? trajectory.paceStatus}
                    </span>
                  ) : null}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
                  {goal.targetDate ? <span>Target: {formatTargetDate(goal.targetDate)}</span> : null}
                  {trajectory && trajectory.weeksRemaining !== null ? (
                    <span>{trajectory.weeksRemaining} weeks left</span>
                  ) : null}
                  {trajectory ? (
                    <span>
                      {trajectory.currentValue} → {trajectory.targetValue}
                    </span>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
