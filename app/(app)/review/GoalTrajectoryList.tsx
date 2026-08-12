import Link from "next/link";
import { Card } from "@/platform/ui/Card";
import type { ReviewFactsBundle } from "@/domains/review/service";
import type { GoalTrajectory } from "@/domains/review/trajectory";

const PACE_LABELS: Record<string, string> = {
  ahead: "Ahead of pace",
  on_pace: "On pace",
  behind: "Behind pace",
  insufficient_data: "Not enough data yet",
  not_applicable: "No target set",
};

const PACE_STYLES: Record<string, string> = {
  ahead: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  on_pace: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  behind: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  insufficient_data: "bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
  not_applicable: "bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
};

function formatDate(dateIso: string): string {
  return new Date(`${dateIso}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Web equivalent of areta-mobile's GoalTrajectoryCard — used by both the
 * new Insights (sliced to top 1-2 goals) and Trends (full list) tabs, and
 * shares this exact rendering with app/(app)/goals/page.tsx's own list
 * (that page stays the one-stop "every goal, ranked" view; this component
 * is what Review's two tabs embed). "Edit target" links to the existing
 * /goals/[goalId]/edit page rather than a modal — web already has that
 * full-page flow, no need for a second interaction pattern.
 */
export function GoalTrajectoryList({
  goals,
  trajectories,
  limit,
}: {
  goals: ReviewFactsBundle["activeGoals"];
  trajectories: GoalTrajectory[];
  limit?: number;
}) {
  const trajectoryByGoal = new Map(trajectories.map((t) => [t.goalId, t]));
  const visibleGoals = limit ? goals.slice(0, limit) : goals;

  if (visibleGoals.length === 0) {
    return (
      <Card tone="surface">
        <p className="text-sm text-neutral-500">No active goals yet.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {visibleGoals.map((goal, index) => {
        const trajectory = trajectoryByGoal.get(goal.id);
        return (
          <Card key={goal.id} tone="surface">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium">
                {index + 1}. {goal.outcome}
              </p>
              {trajectory ? (
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${PACE_STYLES[trajectory.paceStatus]}`}>
                  {PACE_LABELS[trajectory.paceStatus] ?? trajectory.paceStatus}
                </span>
              ) : null}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
              {trajectory ? (
                <>
                  <span>
                    {trajectory.currentValue} → {trajectory.targetValue}
                  </span>
                  {trajectory.weeksRemaining !== null ? <span>{trajectory.weeksRemaining} weeks left</span> : null}
                  {trajectory.projectedCompletionDate ? (
                    <span>At current pace: ~{formatDate(trajectory.projectedCompletionDate)}</span>
                  ) : null}
                </>
              ) : null}
              <Link href={`/goals/${goal.id}/edit`} className="text-brand hover:underline">
                {trajectory ? "Edit target" : "Set a target"}
              </Link>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
