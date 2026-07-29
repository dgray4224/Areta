"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useChartColors } from "./colors";
import { ChartTooltip } from "./ChartTooltip";

export type WeightTrendDatum = {
  date: string;
  weight: number | null;
  sevenDayAverage: number | null;
};

function formatDateTick(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Emphasis form (dataviz skill): raw weigh-ins are context (small gray
 * dots), the 7-day moving average is the accent line — the trend is the
 * story, not any single reading. */
export function WeightTrendChart({ data, unit }: { data: WeightTrendDatum[]; unit: string }) {
  const colors = useChartColors();

  if (data.length === 0) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">No weight logged yet.</p>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors.textMuted }} />
          Logged
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3" style={{ backgroundColor: colors.sequential }} />
          7-day average
        </span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
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
            domain={["auto", "auto"]}
            tickFormatter={(v: number) => (Math.round(v * 10) / 10).toLocaleString()}
            tickLine={false}
            axisLine={false}
            tick={{ fill: colors.textMuted, fontSize: 11 }}
            width={40}
          />
          <Tooltip
            content={(props) => (
              <ChartTooltip {...props} unit={` ${unit}`} formatValue={(v) => String(Math.round(v * 10) / 10)} />
            )}
            cursor={{ stroke: colors.baseline }}
          />
          <Line
            dataKey="weight"
            name="Logged"
            stroke="transparent"
            dot={{ r: 3, fill: colors.textMuted, strokeWidth: 0 }}
            activeDot={{ r: 4, fill: colors.textMuted, strokeWidth: 2, stroke: "var(--background)" }}
            isAnimationActive={false}
            connectNulls
          />
          <Line
            dataKey="sevenDayAverage"
            name="7-day average"
            stroke={colors.sequential}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, fill: colors.sequential, strokeWidth: 2, stroke: "var(--background)" }}
            isAnimationActive={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
