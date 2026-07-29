"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useChartColors } from "./colors";
import { ChartTooltip } from "./ChartTooltip";

export type TaskCompletionDatum = { date: string; completionPercent: number };

function formatDateTick(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

export function TaskCompletionChart({ data }: { data: TaskCompletionDatum[] }) {
  const colors = useChartColors();

  if (data.length === 0) {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">No tasks logged yet.</p>;
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
          domain={[0, 100]}
          tickLine={false}
          axisLine={false}
          tick={{ fill: colors.textMuted, fontSize: 11 }}
          width={32}
        />
        <Tooltip
          content={(props) => <ChartTooltip {...props} unit="%" />}
          cursor={{ fill: colors.gridline, opacity: 0.5 }}
        />
        <Bar
          dataKey="completionPercent"
          name="Completed"
          fill={colors.sequential}
          radius={[4, 4, 0, 0]}
          maxBarSize={24}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
