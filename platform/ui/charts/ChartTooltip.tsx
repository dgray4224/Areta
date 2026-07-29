"use client";

import type { TooltipContentProps } from "recharts/types/component/Tooltip";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

/** Shared tooltip: value leads (bold, primary ink), series name follows
 * (secondary ink), a short line-key swatch carries identity — never a
 * filled box, never color on the text itself (dataviz skill interaction
 * spec). Every series at that x-position is listed in one tooltip. */
export function ChartTooltip({
  active,
  payload,
  label,
  unit = "",
  formatValue,
}: TooltipContentProps<ValueType, NameType> & {
  unit?: string;
  formatValue?: (v: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      {label ? <p className="mb-1 text-neutral-500 dark:text-neutral-400">{String(label)}</p> : null}
      <div className="space-y-1">
        {payload.map((entry, i: number) => {
          const numeric = typeof entry.value === "number" ? entry.value : null;
          const displayValue =
            numeric !== null ? (formatValue ? formatValue(numeric) : numeric) : entry.value;
          return (
            <div key={i} className="flex items-center gap-2">
              <span
                className="inline-block h-0.5 w-3 shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                {displayValue}
                {unit}
              </span>
              <span className="text-neutral-500 dark:text-neutral-400">{entry.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
