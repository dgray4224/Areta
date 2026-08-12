import { Card } from "@/platform/ui/Card";
import { getReviewSummaryBundle } from "@/domains/review/service";
import { getVitalsTrend } from "@/domains/review/vitals";
import { getEnergyBalanceTrend } from "@/domains/review/energy-balance";
import { VitalsMiniChart } from "@/platform/ui/charts/VitalsMiniChart";
import type { ChartColors } from "@/platform/ui/charts/colors";
import type { WeeklyMetrics } from "@/domains/review/metrics";
import { GoalTrajectoryList } from "./GoalTrajectoryList";

const VITALS_METRICS: {
  key: string;
  label: string;
  unit: string;
  seriesKey: keyof Pick<ChartColors, "series1" | "series2" | "series3" | "series4" | "series5">;
}[] = [
  { key: "weight", label: "Weight", unit: "lb", seriesKey: "series1" },
  { key: "sleep", label: "Sleep", unit: "min", seriesKey: "series2" },
  { key: "steps", label: "Steps", unit: "", seriesKey: "series3" },
  { key: "resting_heart_rate", label: "Resting heart rate", unit: "bpm", seriesKey: "series4" },
  { key: "heart_rate_variability", label: "Heart rate variability", unit: "ms", seriesKey: "series5" },
];

type Comparison = { key: keyof WeeklyMetrics; label: string; unit: string; higherIsBetter: boolean };

const COMPARISONS: Comparison[] = [
  { key: "taskCompletionPercent", label: "Task completion", unit: "%", higherIsBetter: true },
  { key: "calorieAdherencePercent", label: "Calorie adherence", unit: "%", higherIsBetter: true },
  { key: "proteinAdherencePercent", label: "Protein adherence", unit: "%", higherIsBetter: true },
  { key: "averageSleepMinutes", label: "Avg sleep", unit: "min", higherIsBetter: true },
];

/** Superset of COMPARISONS' labels — also covers the metric fields
 * domains/review/correlations.ts's CANDIDATE_PAIRS can reference. */
const METRIC_LABELS: Partial<Record<keyof WeeklyMetrics, string>> = {
  averageSleepMinutes: "Sleep",
  taskCompletionPercent: "Task completion",
  calorieAdherencePercent: "Calorie adherence",
  proteinAdherencePercent: "Protein adherence",
  averagePainThisWeek: "Pain",
  learningMinutes: "Learning minutes",
  weightChangeLb: "Weight change",
  averageWeightThisWeek: "Weight",
};
function metricLabel(key: keyof WeeklyMetrics): string {
  return METRIC_LABELS[key] ?? String(key);
}
function jumpMetricLabel(metric: "taskCompletionPercent" | "adherenceScore"): string {
  return metric === "adherenceScore" ? "Overall adherence" : metricLabel(metric);
}

function ComparisonRow({ comparison, current, previous }: { comparison: Comparison; current: number | null; previous: number | null }) {
  if (current === null || previous === null) {
    return (
      <div className="flex items-center justify-between border-b border-black/5 py-2 text-sm last:border-0 dark:border-white/5">
        <span>{comparison.label}</span>
        <span className="text-xs text-neutral-400">Not enough data</span>
      </div>
    );
  }
  const delta = Math.round((current - previous) * 10) / 10;
  const improved = comparison.higherIsBetter ? delta > 0 : delta < 0;
  const worsened = comparison.higherIsBetter ? delta < 0 : delta > 0;
  const deltaClass = improved ? "text-accent" : worsened ? "text-red-600 dark:text-red-400" : "text-neutral-400";
  return (
    <div className="flex items-center justify-between border-b border-black/5 py-2 text-sm last:border-0 dark:border-white/5">
      <span>{comparison.label}</span>
      <span className="flex items-baseline gap-1.5">
        <span>
          {current}
          {comparison.unit}
        </span>
        <span className={`text-xs font-semibold ${deltaClass}`}>
          {delta > 0 ? "+" : ""}
          {delta}
          {comparison.unit} vs last week
        </span>
      </span>
    </div>
  );
}

/**
 * Review tab's "Trends" sub-tab (replaces "Vitals" + "Streaks" + most of
 * the old query-param tab set as one scrollable, chart-forward screen) —
 * for anyone who wants the raw numbers behind Insights' narrative: streak
 * stats, full goal trajectories (weight chart below gets a real
 * target-line overlay when a weight_lb goal has a target), week-over-week
 * comparisons, calorie balance, vitals sparklines, and cross-domain
 * correlations. Matches areta-mobile's Trends.tsx.
 */
export async function Trends({ userId }: { userId: string }) {
  const [bundle, vitalsTrend, energyTrend] = await Promise.all([
    getReviewSummaryBundle(userId),
    getVitalsTrend(userId, VITALS_METRICS.map((m) => m.key) as Parameters<typeof getVitalsTrend>[1]),
    getEnergyBalanceTrend(userId, 14),
  ]);

  const weightGoalTrajectory = bundle.goalTrajectories.find((t) => t.metricType === "weight_lb");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <Card tone="surface" className="text-center">
          <p className="text-2xl font-bold">{bundle.streaks.currentLoggingStreakDays}</p>
          <p className="mt-1 text-xs text-neutral-500">Day logging streak</p>
        </Card>
        <Card tone="surface" className="text-center">
          <p className="text-2xl font-bold">{bundle.streaks.bestLoggingStreakDays}</p>
          <p className="mt-1 text-xs text-neutral-500">Best in 60 days</p>
        </Card>
        <Card tone="surface" className="text-center">
          <p className="text-2xl font-bold">{bundle.streaks.currentAllTasksCompleteWeeks}</p>
          <p className="mt-1 text-xs text-neutral-500">Perfect task weeks</p>
        </Card>
      </div>

      {bundle.goalTrajectories.length > 0 ? (
        <GoalTrajectoryList goals={bundle.activeGoals} trajectories={bundle.goalTrajectories} />
      ) : null}

      {bundle.achievements.isPersonalBestAdherenceWeek ? (
        <div className="rounded-lg border border-accent/40 bg-accent/10 p-3 text-sm font-medium text-accent">
          This is your best adherence week yet — {bundle.achievements.personalBestAdherenceScore}%
        </div>
      ) : null}

      {bundle.achievements.biggestWeekOverWeekJump || bundle.achievements.personalBestWeekStart ? (
        <div className="space-y-2">
          {bundle.achievements.biggestWeekOverWeekJump ? (
            <Card tone="surface" className="text-sm">
              Biggest jump: {jumpMetricLabel(bundle.achievements.biggestWeekOverWeekJump.metric)}{" "}
              <span
                className={
                  bundle.achievements.biggestWeekOverWeekJump.direction === "improvement"
                    ? "font-semibold text-accent"
                    : "font-semibold text-red-600 dark:text-red-400"
                }
              >
                {bundle.achievements.biggestWeekOverWeekJump.direction === "improvement" ? "+" : ""}
                {bundle.achievements.biggestWeekOverWeekJump.delta}
              </span>
            </Card>
          ) : null}
          {bundle.achievements.personalBestWeekStart ? (
            <Card tone="surface" className="text-sm">
              Personal best week: {bundle.achievements.personalBestWeekStart}
              {bundle.achievements.personalBestAdherenceScore !== null
                ? ` (${bundle.achievements.personalBestAdherenceScore}%)`
                : ""}
            </Card>
          ) : null}
        </div>
      ) : null}

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">This week vs last week</p>
        <Card tone="surface" className="mt-2">
          {COMPARISONS.map((c) => (
            <ComparisonRow
              key={c.key}
              comparison={c}
              current={(bundle.metrics?.[c.key] as number | null) ?? null}
              previous={(bundle.previousWeekMetrics?.[c.key] as number | null) ?? null}
            />
          ))}
        </Card>
      </div>

      {energyTrend.days.length > 0 ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Calorie balance</p>
          <Card tone="hero" className="mt-2">
            <p className="text-xs uppercase text-neutral-500">Average daily net</p>
            <p className="mt-1 text-2xl font-bold">
              {energyTrend.weeklyAverageNet === null
                ? "No data yet"
                : `${energyTrend.weeklyAverageNet > 0 ? "+" : ""}${energyTrend.weeklyAverageNet} kcal/day`}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              {energyTrend.weeklyAverageNet === null
                ? "Log meals and sync HealthKit energy data to see this."
                : energyTrend.weeklyAverageNet < 0
                  ? "Deficit — burning more than you're eating"
                  : "Surplus — eating more than you're burning"}
            </p>
          </Card>
          <Card tone="surface" className="mt-2">
            {energyTrend.days
              .slice()
              .reverse()
              .map((d) => (
                <div
                  key={d.date}
                  className="flex items-center justify-between gap-2 border-b border-black/5 py-1.5 text-sm last:border-0 dark:border-white/5"
                >
                  <span className="w-14 shrink-0 text-xs text-neutral-500">{d.date.slice(5)}</span>
                  <span className="flex-1 text-xs">
                    In {d.caloriesIn ?? "—"} · Out {d.caloriesOutTotal ?? "—"}
                    {d.usedFallbackBmr ? " (est.)" : ""}
                  </span>
                  <span
                    className={
                      d.netCalories === null
                        ? "text-xs text-neutral-500"
                        : d.netCalories < 0
                          ? "text-xs font-semibold text-accent"
                          : "text-xs font-semibold text-red-600 dark:text-red-400"
                    }
                  >
                    {d.netCalories === null ? "—" : `${d.netCalories > 0 ? "+" : ""}${d.netCalories}`}
                  </span>
                </div>
              ))}
          </Card>
        </div>
      ) : null}

      <div className="space-y-4">
        {VITALS_METRICS.map((m) => {
          const series = vitalsTrend[m.key] ?? [];
          const latest = series[series.length - 1];
          return (
            <Card key={m.key} tone="surface">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{m.label}</p>
                {latest ? (
                  <p className="text-xs text-neutral-500">
                    {latest.value}
                    {m.unit ? ` ${m.unit}` : ""} latest
                  </p>
                ) : null}
              </div>
              {series.length > 0 ? (
                <div className="mt-2">
                  <VitalsMiniChart
                    data={series}
                    unit={m.unit}
                    seriesKey={m.seriesKey}
                    targetValue={m.key === "weight" ? weightGoalTrajectory?.targetValue : undefined}
                    targetLabel={m.key === "weight" ? "Target" : undefined}
                  />
                </div>
              ) : (
                <p className="mt-2 text-sm text-neutral-400">No data yet</p>
              )}
            </Card>
          );
        })}
      </div>

      {bundle.correlationFindings.length > 0 ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Patterns in your data</p>
          <div className="mt-2 space-y-2">
            {bundle.correlationFindings.map((finding, i) => (
              <Card key={i} tone="surface" className="text-sm">
                <p>
                  {metricLabel(finding.metricA)} and {metricLabel(finding.metricB)} tend to move{" "}
                  {finding.direction === "positive" ? "together" : "in opposite directions"}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  r = {finding.r.toFixed(2)} across {finding.weekCount} weeks
                </p>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
