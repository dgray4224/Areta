import { Card } from "@/platform/ui/Card";
import { getVitalsTrend } from "@/domains/review/vitals";
import { VitalsMiniChart } from "@/platform/ui/charts/VitalsMiniChart";
import type { ChartColors } from "@/platform/ui/charts/colors";

const METRICS: {
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

/**
 * Review tab's "Vitals" sub-tab — day-bucketed trend sparklines for a
 * starter set of HealthKit metric types that sync from the mobile
 * companion app with zero consumer UI anywhere else on web. Matches
 * areta-mobile's VitalsTrends.tsx (same five metrics, same
 * getVitalsTrend source), rendered server-side here instead of a client
 * fetch since the web app already has the data available at request
 * time.
 */
export async function VitalsTrends({ userId }: { userId: string }) {
  const trend = await getVitalsTrend(
    userId,
    METRICS.map((m) => m.key) as Parameters<typeof getVitalsTrend>[1]
  );

  return (
    <div className="space-y-4">
      {METRICS.map((m) => {
        const series = trend[m.key] ?? [];
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
                <VitalsMiniChart data={series} unit={m.unit} seriesKey={m.seriesKey} />
              </div>
            ) : (
              <p className="mt-2 text-sm text-neutral-400">No data yet</p>
            )}
          </Card>
        );
      })}
    </div>
  );
}
