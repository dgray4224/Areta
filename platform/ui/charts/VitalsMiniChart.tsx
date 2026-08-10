"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useChartColors, type ChartColors } from "./colors";
import { ChartTooltip } from "./ChartTooltip";

export type VitalsSeriesDatum = { date: string; value: number };

function formatDateTick(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return d.toLocaleDateString(undefined, { month: "numeric", day: "numeric", timeZone: "UTC" });
}

/** One compact sparkline per vitals metric on the Review tab's Vitals
 * sub-tab — five of these side by side, so each stays small: no
 * gridlines/Y-axis, just the line, an X-axis date strip, and a tooltip.
 * seriesKey picks which of the five validated chart colors (colors.ts)
 * this metric gets, so all five stay visually distinct without inventing
 * a new palette. */
export function VitalsMiniChart({
  data,
  unit,
  seriesKey,
}: {
  data: VitalsSeriesDatum[];
  unit: string;
  seriesKey: keyof Pick<ChartColors, "series1" | "series2" | "series3" | "series4" | "series5">;
}) {
  const colors = useChartColors();
  const color = colors[seriesKey];

  return (
    <ResponsiveContainer width="100%" height={90}>
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
        <XAxis
          dataKey="date"
          tickFormatter={formatDateTick}
          tickLine={false}
          axisLine={{ stroke: colors.baseline }}
          tick={{ fill: colors.textMuted, fontSize: 10 }}
          minTickGap={20}
        />
        <Tooltip
          content={(props) => <ChartTooltip {...props} unit={unit ? ` ${unit}` : ""} formatValue={(v) => String(v)} />}
          cursor={{ stroke: colors.baseline }}
        />
        <Line
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: color, strokeWidth: 2, stroke: "var(--background)" }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
