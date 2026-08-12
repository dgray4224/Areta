import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/platform/auth/session";
import { getGoalById } from "@/domains/goals/service";
import { GoalTargetForm } from "./GoalTargetForm";

/**
 * Post-onboarding goal-target set/edit — the real gap onboarding's Goals
 * step left: once a goal exists, there was previously no way to set a
 * target on it (or change one) without redoing onboarding. Reachable from
 * an "Edit target" link on each goal card in `/goals`.
 */
export default async function GoalEditPage({ params }: { params: Promise<{ goalId: string }> }) {
  const user = await requireUser();
  const { goalId } = await params;
  const goal = await getGoalById(user.id, goalId);
  if (!goal) notFound();

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-10">
      <div>
        <Link href="/goals" className="text-sm text-neutral-500 hover:underline">
          ← Back to goals
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Set a target</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{goal.outcome}</p>
      </div>

      <GoalTargetForm userId={user.id} goal={goal} />
    </div>
  );
}
