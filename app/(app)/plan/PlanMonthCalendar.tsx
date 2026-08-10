"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/platform/ui/Card";
import { RecipePhoto } from "@/platform/ui/RecipePhoto";
import { shiftMonth, monthLabel, formatShortDate } from "./calendar-date-utils";

const DAY_HEADER_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type CalendarDay = {
  date: string;
  meals: { id: string; mealType: string; recipeName: string; photoUrl: string | null; completed: boolean }[];
  workouts: { id: string; exerciseName: string; completed: boolean }[];
};

function getWeekDates(anchor: string): string[] {
  const d = new Date(`${anchor}T00:00:00Z`);
  const sunday = new Date(d);
  sunday.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(sunday);
    dt.setUTCDate(sunday.getUTCDate() + i);
    return dt.toISOString().slice(0, 10);
  });
}

function namesOrNone(names: string[], noneLabel: string): string {
  return names.length > 0 ? names.join(", ") : noneLabel;
}

/**
 * Plan's Calendar view — month grid with dot indicators (mirrors
 * areta-mobile's PlanCalendar.tsx: tap/click a day to select, dots show
 * which days have meals/a workout planned) plus an always-visible panel
 * below for the selected date: either that day's detail ("Day") or a
 * compact read-only rundown of its whole Sun-Sat week ("Week"). Replaces
 * the old 7-narrow-cards-only week strip (PlanWeekCalendar.tsx), which
 * had no month view at all and couldn't show "what's coming up" beyond
 * the current week.
 *
 * The whole visible grid's data is fetched server-side once per month
 * (getPlanRange spanning gridBounds) and passed in — day selection and
 * the Day/Week toggle are pure client state, no refetch. Only changing
 * months (prev/next/today, via calendar-date-utils' Links) triggers a
 * new server request.
 *
 * Deliberately read-only for this pass, same as the component it
 * replaces — complete-toggle/swap/notes live on the interactive
 * Nutrition/Exercise domain pages already; this panel links out to the
 * full meal/workout plan pages for anything beyond a glance, matching
 * where the mobile-vs-web parity audit left Plan-tab interactivity
 * (flagged, deferred, not part of this fix).
 */
export function PlanMonthCalendar({
  month,
  today,
  gridDates,
  days,
}: {
  month: string;
  today: string;
  gridDates: string[];
  days: CalendarDay[];
}) {
  const [selectedDay, setSelectedDay] = useState(gridDates.includes(today) ? today : gridDates[0]);
  const [viewMode, setViewMode] = useState<"day" | "week">("day");

  const dayByDate = new Map(days.map((d) => [d.date, d]));
  const weeks: string[][] = [];
  for (let i = 0; i < gridDates.length; i += 7) weeks.push(gridDates.slice(i, i + 7));

  const selectedWeekDates = getWeekDates(selectedDay);
  const selectedDayData = dayByDate.get(selectedDay);
  const isCurrentMonth = month === today.slice(0, 7);

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/plan?month=${shiftMonth(month, -1)}`}
          className="flex h-8 w-8 items-center justify-center rounded-full text-brand hover:bg-black/[0.03] dark:hover:bg-white/5"
          aria-label="Previous month"
        >
          ‹
        </Link>
        <Link
          href={`/plan?month=${today.slice(0, 7)}`}
          className={`text-sm font-medium ${isCurrentMonth ? "pointer-events-none text-neutral-400" : "text-foreground hover:underline"}`}
        >
          {monthLabel(month)}
        </Link>
        <Link
          href={`/plan?month=${shiftMonth(month, 1)}`}
          className="flex h-8 w-8 items-center justify-center rounded-full text-brand hover:bg-black/[0.03] dark:hover:bg-white/5"
          aria-label="Next month"
        >
          ›
        </Link>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1">
        {DAY_HEADER_LABELS.map((label, i) => (
          <div key={i} className="text-center text-[11px] font-medium text-neutral-500">
            {label}
          </div>
        ))}
        {weeks.map((week) =>
          week.map((date) => {
            const inMonth = date.slice(0, 7) === month;
            const isToday = date === today;
            const isSelected = date === selectedDay;
            const day = dayByDate.get(date);
            const hasWorkout = (day?.workouts.length ?? 0) > 0;
            const hasMeals = (day?.meals.length ?? 0) > 0;
            const dayNumber = Number(date.slice(8, 10));
            return (
              <button
                key={date}
                type="button"
                onClick={() => setSelectedDay(date)}
                aria-pressed={isSelected}
                className={`flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-lg border text-sm transition-colors ${
                  isSelected
                    ? "border-brand bg-brand/10"
                    : isToday
                      ? "border-brand"
                      : "border-neutral-200 dark:border-neutral-800"
                } ${inMonth ? "text-foreground" : "text-neutral-400"}`}
              >
                <span className={isToday ? "font-bold" : ""}>{dayNumber}</span>
                <span className="flex h-1.5 gap-1">
                  {hasWorkout ? <span className="h-1.5 w-1.5 rounded-full bg-accent" /> : null}
                  {hasMeals ? <span className="h-1.5 w-1.5 rounded-full bg-brand" /> : null}
                </span>
              </button>
            );
          })
        )}
      </div>

      <div className="mt-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setViewMode("day")}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                viewMode === "day"
                  ? "border-brand bg-brand text-brand-ink"
                  : "border-neutral-200 text-foreground dark:border-neutral-800"
              }`}
            >
              Day
            </button>
            <button
              type="button"
              onClick={() => setViewMode("week")}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                viewMode === "week"
                  ? "border-brand bg-brand text-brand-ink"
                  : "border-neutral-200 text-foreground dark:border-neutral-800"
              }`}
            >
              Week
            </button>
          </div>
          <div className="flex gap-3 text-xs text-neutral-500">
            <Link href="/plan/meals" className="hover:text-brand">
              Full meal plan
            </Link>
            <Link href="/plan/workouts" className="hover:text-brand">
              Full workout plan
            </Link>
          </div>
        </div>

        {viewMode === "day" ? (
          <div>
            <p className="text-sm font-medium">{formatShortDate(selectedDay)}</p>
            <div className="mt-2 space-y-3">
              <div>
                <p className="text-xs font-medium text-neutral-500">Workout</p>
                {selectedDayData && selectedDayData.workouts.length > 0 ? (
                  <ul className="mt-1 space-y-1">
                    {selectedDayData.workouts.map((w) => (
                      <li key={w.id} className="flex items-center gap-2 text-sm">
                        <span className={w.completed ? "text-accent" : "text-neutral-300 dark:text-neutral-700"}>●</span>
                        {w.exerciseName}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-neutral-500">Rest day</p>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-neutral-500">Meals</p>
                {selectedDayData && selectedDayData.meals.length > 0 ? (
                  <ul className="mt-1 space-y-1.5">
                    {selectedDayData.meals.map((m) => (
                      <li key={m.id} className="flex items-center gap-2 text-sm">
                        <RecipePhoto url={m.photoUrl} size={28} className="shrink-0" />
                        <span className={m.completed ? "text-neutral-500 line-through" : ""}>{m.recipeName}</span>
                        <span className="text-xs text-neutral-400">{m.mealType}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-neutral-500">No meals planned</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div>
            <p className="mb-2 text-sm font-medium">
              Week of {formatShortDate(selectedWeekDates[0])} – {formatShortDate(selectedWeekDates[6])}
            </p>
            <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {selectedWeekDates.map((date, i) => {
                const day = dayByDate.get(date);
                const isSelected = date === selectedDay;
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => {
                      setSelectedDay(date);
                      setViewMode("day");
                    }}
                    className={`flex w-full items-start gap-3 py-2 text-left ${isSelected ? "text-brand" : ""}`}
                  >
                    <span className="w-16 shrink-0 text-xs font-semibold">
                      {DAY_LABELS[i]} {formatShortDate(date)}
                    </span>
                    <span className="flex-1 text-xs text-neutral-500">
                      <span className="block">{namesOrNone(day?.workouts.map((w) => w.exerciseName) ?? [], "Rest day")}</span>
                      <span className="block">{namesOrNone(day?.meals.map((m) => m.recipeName) ?? [], "No meals planned")}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
