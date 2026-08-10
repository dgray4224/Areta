import { Card } from "@/platform/ui/Card";
import type { ReviewSummaryBundle } from "@/domains/review/service";
import type { WeeklyMetrics } from "@/domains/review/metrics";

type Comparison = { key: keyof WeeklyMetrics; label: string; unit: string; higherIsBetter: boolean };

const COMPARISONS: Comparison[] = [
  { key: "taskCompletionPercent", label: "Task completion", unit: "%", higherIsBetter: true },
  { key: "calorieAdherencePercent", label: "Calorie adherence", unit: "%", higherIsBetter: true },
  { key: "proteinAdherencePercent", label: "Protein adherence", unit: "%", higherIsBetter: true },
  { key: "averageSleepMinutes", label: "Avg sleep", unit: "min", higherIsBetter: true },
];

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
 * Review tab's "Streaks" sub-tab — deterministic streak facts
 * (domains/review/streaks.ts) plus a week-over-week comparison, both
 * already computed as part of getReviewSummaryBundle so this is purely a
 * render, no new data fetching. Matches areta-mobile's
 * StreaksAndComparison.tsx.
 */
export function StreaksAndComparison({ bundle }: { bundle: ReviewSummaryBundle }) {
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

      {bundle.achievements.isPersonalBestAdherenceWeek ? (
        <div className="rounded-lg border border-accent/40 bg-accent/10 p-3 text-sm font-medium text-accent">
          This is your best adherence week yet — {bundle.achievements.personalBestAdherenceScore}%
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
    </div>
  );
}
