"use client";

import { useState } from "react";
import { DayEditorPanel } from "./DayEditorPanel";
import type { ProjectedMealDay } from "@/domains/trainermealprogram/calendar-projection";
import type { Recipe } from "@/domains/recipes/types";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const SOURCE_STYLE: Record<ProjectedMealDay["source"], string> = {
  not_started: "text-neutral-300 dark:text-neutral-700",
  ended: "text-neutral-300 dark:text-neutral-700",
  phases_complete: "text-neutral-400 dark:text-neutral-600 border-dashed",
  no_meals: "text-neutral-400 dark:text-neutral-600",
  template: "border-brand/30 bg-brand-fill/10",
  override: "border-amber-400/60 bg-amber-50 dark:bg-amber-950/40",
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Nutrition-side mirror of the workout calendar's CalendarMonthView.tsx.
 * Deliberately no drag-to-move here (2026-08-07, a scoping call, not an
 * oversight) -- a workout day drags one session's fully-specified
 * prescription; a meal day can carry several meals with no live
 * calorie-target input to resolve template-sourced servings against
 * client-side, so a faithful move would need to resolve real portions
 * server-side before constructing the destination override. Click-to-edit
 * (below) already covers the core "see the month, override any day" value
 * this calendar exists for; drag-to-move is a reasonable fast-follow, not
 * essential to ship first. */
export function CalendarMonthView({
  clientId,
  monthStart,
  days,
  recipes,
}: {
  clientId: string;
  monthStart: string;
  days: ProjectedMealDay[];
  recipes: Recipe[];
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const today = todayIso();
  const currentMonthKey = monthStart.slice(0, 7);

  const isEditable = (day: ProjectedMealDay) =>
    day.source !== "not_started" && day.source !== "ended" && day.date >= today;

  const selectedDay = days.find((d) => d.date === selectedDate) ?? null;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-neutral-500">
        {DAY_LABELS.map((l) => (
          <div key={l}>{l}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const inMonth = day.date.slice(0, 7) === currentMonthKey;
          const editable = isEditable(day);
          const dayNumber = Number(day.date.slice(8, 10));
          return (
            <button
              key={day.date}
              type="button"
              onClick={() => editable && setSelectedDate(day.date)}
              disabled={!editable}
              className={`min-h-20 rounded-lg border p-1.5 text-left text-xs transition-colors ${
                inMonth ? "" : "opacity-40"
              } ${SOURCE_STYLE[day.source]} ${editable ? "cursor-pointer hover:border-brand/60" : "cursor-default"} ${
                day.date === today ? "ring-2 ring-brand" : "border-neutral-200 dark:border-neutral-800"
              }`}
            >
              <div className="font-medium">{dayNumber}</div>
              {day.source === "ended" ? (
                <p className="mt-1 text-neutral-400">Ended</p>
              ) : day.source === "not_started" ? null : day.source === "phases_complete" ? (
                <p className="mt-1 text-neutral-400">No program</p>
              ) : day.meals.length > 0 ? (
                <p className="mt-1 text-neutral-500">
                  {day.meals.length} meal{day.meals.length === 1 ? "" : "s"}
                </p>
              ) : (
                <p className="mt-1 text-neutral-400">No meals</p>
              )}
              {day.source === "override" ? <p className="mt-0.5 text-amber-700 dark:text-amber-400">Custom</p> : null}
            </button>
          );
        })}
      </div>

      {selectedDay ? (
        <DayEditorPanel clientId={clientId} day={selectedDay} recipes={recipes} onClose={() => setSelectedDate(null)} />
      ) : null}
    </div>
  );
}
