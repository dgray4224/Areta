"use client";

import { useRouter } from "next/navigation";

export function WeekPicker({
  weekStart,
  options,
}: {
  weekStart: string;
  options: string[];
}) {
  const router = useRouter();
  const index = options.indexOf(weekStart);
  // options is sorted newest-first, so "previous" (older) is the next index up.
  const olderWeek = index >= 0 && index < options.length - 1 ? options[index + 1] : null;
  const newerWeek = index > 0 ? options[index - 1] : null;

  const goTo = (week: string) => {
    router.push(`/plan?view=week&week=${week}`);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => olderWeek && goTo(olderWeek)}
        disabled={!olderWeek}
        className="rounded-full border border-neutral-300 px-3 py-1 text-sm disabled:opacity-30 dark:border-neutral-700"
      >
        ← Older
      </button>
      <select
        value={weekStart}
        onChange={(e) => goTo(e.target.value)}
        className="rounded-full border border-neutral-300 bg-card px-3 py-1 text-sm dark:border-neutral-700"
      >
        {options.includes(weekStart) ? null : <option value={weekStart}>{weekStart}</option>}
        {options.map((w) => (
          <option key={w} value={w}>
            Week of {w}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => newerWeek && goTo(newerWeek)}
        disabled={!newerWeek}
        className="rounded-full border border-neutral-300 px-3 py-1 text-sm disabled:opacity-30 dark:border-neutral-700"
      >
        Newer →
      </button>
    </div>
  );
}
