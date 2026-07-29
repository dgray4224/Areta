"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useChartColors } from "./colors";
import { ChartTooltip } from "./ChartTooltip";

export type SleepTrendDatum = { date: string; hours: number | null };

function formatDateTick(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Single series -> sequential blue, no legend needed (dataviz skill:
 * "a single series needs no legend box"). */
export function SleepTrendChart({ data }: { data: SleepTrendDatum[] }) {
  const colors = useChartColors();

  if (data.every((d) => d.hours === null)) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">No sleep logged yet.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={colors.gridline} />
        <XAxis
          dataKey="date"
          tickFormatter={formatDateTick}
          tickLine={false}
          axisLine={{ stroke: colors.baseline }}
          tick={{ fill: colors.textMuted, fontSize: 11 }}
          minTickGap={24}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fill: colors.textMuted, fontSize: 11 }}
          width={28}
        />
        <Tooltip
          content={(props) => (
            <ChartTooltip {...props} unit="h" formatValue={(v) => String(Math.round(v * 10) / 10)} />
          )}
          cursor={{ fill: colors.gridline, opacity: 0.5 }}
        />
        <Bar dataKey="hours" name="Sleep" fill={colors.sequential} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
