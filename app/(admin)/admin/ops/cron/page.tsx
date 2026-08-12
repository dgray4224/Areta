import { countStaleWorkoutPlans, countAiRunFailures } from "@/domains/ops/service";
import { Card } from "@/platform/ui/Card";

export default async function CronHealthPage() {
  const [stalePlans, aiFailures7d] = await Promise.all([
    countStaleWorkoutPlans(),
    countAiRunFailures(7),
  ]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        No cron run history is actually logged anywhere — <code className="text-xs">
          regenerate-workout-plans
        </code>{" "}
        (Mondays, 06:00 UTC per <code className="text-xs">vercel.json</code>) returns a JSON response
        and nothing persists it. These are live proxy signals instead: what the cron would act on right
        now, and recent AI-generation failures. A growing stale-plan count with no corresponding drop
        after Monday morning is the practical sign something&apos;s wrong.{" "}
        <code className="text-xs">CRON_SECRET</code> is set in Vercel production as of 2026-08-12 — see
        README for the fix history.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-3xl font-semibold">{stalePlans}</p>
          <p className="mt-1 text-sm text-neutral-500">
            Active workout plans past their week_start right now (what the cron would generate drafts
            for on its next run)
          </p>
        </Card>
        <Card>
          <p className="text-3xl font-semibold">{aiFailures7d}</p>
          <p className="mt-1 text-sm text-neutral-500">AI run failures in the last 7 days</p>
        </Card>
      </div>
    </div>
  );
}
