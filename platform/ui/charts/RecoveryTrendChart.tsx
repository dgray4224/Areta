"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useChartColors } from "./colors";
import { ChartTooltip } from "./ChartTooltip";

export type RecoveryTrendDatum = { date: string; pain: number | null; swelling: number | null };

function formatDateTick(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Two series (pain, swelling) -> categorical, fixed slot order, legend
 * always present at 2+ series (dataviz skill). */
export function RecoveryTrendChart({ data }: { data: RecoveryTrendDatum[] }) {
  const colors = useChartColors();

  if (data.every((d) => d.pain === null && d.swelling === null)) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">No recovery logged yet.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
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
          domain={[0, 10]}
          tickLine={false}
          axisLine={false}
          tick={{ fill: colors.textMuted, fontSize: 11 }}
          width={24}
        />
        <Tooltip content={(props) => <ChartTooltip {...props} />} cursor={{ stroke: colors.baseline }} />
        <Legend
          iconType="plainline"
          wrapperStyle={{ fontSize: 12, color: colors.textSecondary }}
        />
        <Line
          dataKey="pain"
          name="Pain"
          stroke={colors.series1}
          strokeWidth={2}
          dot={{ r: 3, fill: colors.series1, strokeWidth: 0 }}
          activeDot={{ r: 5, fill: colors.series1, strokeWidth: 2, stroke: "var(--background)" }}
          isAnimationActive={false}
          connectNulls
        />
        <Line
          dataKey="swelling"
          name="Swelling"
          stroke={colors.series2}
          strokeWidth={2}
          dot={{ r: 3, fill: colors.series2, strokeWidth: 0 }}
          activeDot={{ r: 5, fill: colors.series2, strokeWidth: 2, stroke: "var(--background)" }}
          isAnimationActive={false}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
