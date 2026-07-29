"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartColors } from "./colors";
import { ChartTooltip } from "./ChartTooltip";

export type NutritionAdherenceDatum = { date: string; calories: number | null };

function formatDateTick(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Line vs baseline (dataviz skill: "Δ to target" job -> diverging bar or
 * line vs baseline). A solid, muted reference line marks the calorie
 * target; the logged-calories line is the one series, so no legend box —
 * the target is direct-labeled at the line's end instead. */
export function NutritionAdherenceChart({
  data,
  target,
}: {
  data: NutritionAdherenceDatum[];
  target: number | null;
}) {
  const colors = useChartColors();

  if (data.every((d) => d.calories === null)) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">No nutrition logged yet.</p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 48, bottom: 0, left: 0 }}>
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
          domain={[0, (dataMax: number) => Math.max(dataMax, target ?? 0) * 1.1]}
          tickFormatter={(v: number) => Math.round(v).toLocaleString()}
          tickLine={false}
          axisLine={false}
          tick={{ fill: colors.textMuted, fontSize: 11 }}
          width={52}
        />
        <Tooltip
          content={(props) => <ChartTooltip {...props} unit=" kcal" />}
          cursor={{ stroke: colors.baseline }}
        />
        {target ? (
          <ReferenceLine
            y={target}
            stroke={colors.textMuted}
            strokeWidth={1}
            label={{ value: `Target ${target}`, position: "insideTopRight", fill: colors.textMuted, fontSize: 11 }}
          />
        ) : null}
        <Line
          dataKey="calories"
          name="Calories"
          stroke={colors.sequential}
          strokeWidth={2}
          dot={{ r: 3, fill: colors.sequential, strokeWidth: 0 }}
          activeDot={{ r: 5, fill: colors.sequential, strokeWidth: 2, stroke: "var(--background)" }}
          isAnimationActive={false}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
