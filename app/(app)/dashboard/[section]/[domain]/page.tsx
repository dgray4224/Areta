import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/platform/auth/session";
import { EmptyState } from "@/platform/ui/EmptyState";
import { getDashboardTrends } from "../../trends-data";
import { getRecentExerciseLogs } from "@/domains/exercise/service";
import { getApprovedParameterValue } from "@/domains/parameters/service";
import { WeightTrendChart } from "@/platform/ui/charts/WeightTrendChart";
import { SleepTrendChart } from "@/platform/ui/charts/SleepTrendChart";
import { NutritionAdherenceChart } from "@/platform/ui/charts/NutritionAdherenceChart";

export default async function DashboardDomainDetailPage({
  params,
}: {
  params: Promise<{ section: string; domain: string }>;
}) {
  const { domain } = await params;
  const user = await requireUser();

  if (domain === "nutrition") {
    const trends = await getDashboardTrends(user.id);
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">Nutrition</h1>
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="mb-1 text-sm font-medium">Calorie adherence · last 30 days</p>
          <NutritionAdherenceChart data={trends.nutrition.data} target={trends.nutrition.target} />
        </div>
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="mb-1 text-sm font-medium">Weight · last 30 days</p>
          <WeightTrendChart data={trends.weight.data} unit={trends.weight.unit} />
        </div>
        <div className="flex gap-4 text-sm">
          <Link href="/plan/parameters" className="underline">
            Nutrition targets
          </Link>
          <Link href="/plan/meals" className="underline">
            Meal plan
          </Link>
          <Link href="/log/nutrition" className="underline">
            Log food
          </Link>
        </div>
      </div>
    );
  }

  if (domain === "sleep") {
    const trends = await getDashboardTrends(user.id);
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">Sleep</h1>
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="mb-1 text-sm font-medium">Sleep duration · last 30 days</p>
          <SleepTrendChart data={trends.sleep} />
        </div>
        <div className="flex gap-4 text-sm">
          <Link href="/log/sleep" className="underline">
            Log sleep
          </Link>
        </div>
      </div>
    );
  }

  if (domain === "exercise") {
    const [sessionsPerWeek, recentLogs] = await Promise.all([
      getApprovedParameterValue(user.id, "exercise", "sessions_per_week"),
      getRecentExerciseLogs(user.id, 14),
    ]);

    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">Exercise</h1>
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-sm font-medium text-neutral-500">Target sessions per week</p>
          <p className="text-lg font-medium">{sessionsPerWeek ?? "Not set yet"}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-neutral-500">Recent sessions</p>
          {recentLogs.length > 0 ? (
            <ul className="mt-2 space-y-1 text-sm">
              {recentLogs.map((log) => (
                <li key={log.id} className="flex justify-between gap-4">
                  <span className="text-neutral-500">{log.date}</span>
                  <span>
                    {log.archetype ?? "Session"}
                    {log.duration_minutes ? ` · ${log.duration_minutes} min` : ""}
                    {log.perceived_exertion ? ` · RPE ${log.perceived_exertion}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No sessions logged yet" />
          )}
        </div>
        <div className="flex gap-4 text-sm">
          <Link href="/plan/exercise-parameters" className="underline">
            Training parameters
          </Link>
          <Link href="/plan/workouts" className="underline">
            Workout plan
          </Link>
          <Link href="/log/exercise" className="underline">
            Log a session
          </Link>
        </div>
      </div>
    );
  }

  notFound();
}
