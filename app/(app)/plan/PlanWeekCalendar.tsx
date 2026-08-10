"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/platform/ui/Card";

export type PlanDayMeal = { id: string; mealType: string; recipeName: string };
export type PlanDayWorkout = { id: string; name: string; sets: number | null; reps: number | null; durationMinutes: number | null };
export type PlanDay = {
  date: string;
  dayName: string;
  isToday: boolean;
  meals: PlanDayMeal[];
  workouts: PlanDayWorkout[];
  hasWorkoutPlan: boolean;
};

function formatPrescription(w: PlanDayWorkout): string {
  if (w.durationMinutes !== null) return `${w.durationMinutes} min`;
  if (w.sets !== null && w.reps !== null) return `${w.sets} × ${w.reps}`;
  return "";
}

function formatDayHeading(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Desktop Plan's calendar + persistent detail panel — the concept mobile
 * proved with PlanCalendar.tsx/PlanDayDetail.tsx (tap a date, see it
 * inline instead of a popup), rebuilt natively for web rather than
 * literally reused: those are React Native components (View/Pressable/
 * Modal), a different rendering target that can't be imported into a
 * Next.js page. This is read-only for the first pass, same "static
 * before interactive" sequencing as the Dashboard timeline — editing,
 * swap, and the draft-approve banner are natural fast-follows once this
 * layout itself is confirmed, not a scope mistake.
 */
export function PlanWeekCalendar({ days }: { days: PlanDay[] }) {
  const initialSelected = days.find((d) => d.isToday)?.date ?? days[0]?.date ?? null;
  const [selectedDate, setSelectedDate] = useState<string | null>(initialSelected);
  const selectedDay = days.find((d) => d.date === selectedDate) ?? null;

  return (
    <div className="xl:grid xl:grid-cols-[1fr_320px] xl:items-start xl:gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {days.map((day) => {
          const isSelected = day.date === selectedDate;
          const hasPlan = day.meals.length > 0 || day.workouts.length > 0;
          return (
            <button
              key={day.date}
              type="button"
              onClick={() => setSelectedDate(day.date)}
              className={`rounded-xl border p-3 text-left transition-colors ${
                isSelected
                  ? "border-brand bg-brand/10"
                  : day.isToday
                    ? "border-2 border-brand/60"
                    : "border-black/5 bg-card hover:bg-black/[0.02] dark:border-white/5 dark:hover:bg-white/5"
              }`}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                {day.dayName}
                {day.isToday ? " · today" : ""}
              </p>
              <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold">
                {hasPlan ? <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" /> : null}
                {day.meals.length + day.workouts.length > 0
                  ? `${day.meals.length + day.workouts.length} planned`
                  : "Nothing planned"}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-4 xl:mt-0">
        <Card tone="surface" className="xl:sticky xl:top-4">
          {selectedDay ? (
            <>
              <h3 className="font-semibold">{formatDayHeading(selectedDay.date)}</h3>

              <div className="mt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Workout</p>
                {!selectedDay.hasWorkoutPlan ? (
                  <p className="mt-1 text-sm text-neutral-400">—</p>
                ) : selectedDay.workouts.length === 0 ? (
                  <p className="mt-1 text-sm text-neutral-400">Rest day</p>
                ) : (
                  <ul className="mt-1.5 space-y-1.5 text-sm">
                    {selectedDay.workouts.map((w) => (
                      <li key={w.id} className="flex items-center justify-between gap-3">
                        <span className="truncate">{w.name}</span>
                        <span className="shrink-0 text-xs text-neutral-400">{formatPrescription(w)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Meals</p>
                {selectedDay.meals.length === 0 ? (
                  <p className="mt-1 text-sm text-neutral-400">—</p>
                ) : (
                  <ul className="mt-1.5 space-y-1.5 text-sm">
                    {selectedDay.meals.map((m) => (
                      <li key={m.id}>
                        <span className="text-xs capitalize text-neutral-500">{m.mealType}</span>
                        <p className="truncate">{m.recipeName}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-5 flex gap-3 border-t border-black/5 pt-3 text-xs dark:border-white/5">
                <Link href="/plan/meals" className="text-brand hover:underline">
                  Full meal plan
                </Link>
                <Link href="/plan/workouts" className="text-brand hover:underline">
                  Full workout plan
                </Link>
              </div>
            </>
          ) : (
            <p className="text-sm text-neutral-500">Pick a day to see its plan.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
