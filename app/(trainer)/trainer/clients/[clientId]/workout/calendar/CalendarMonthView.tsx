"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { moveClientSessionToDate } from "@/domains/trainer/service";
import { DayEditorPanel } from "./DayEditorPanel";
import type { ProjectedDay } from "@/domains/trainerprogram/calendar-projection";
import type { Exercise } from "@/domains/exerciselibrary/types";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const SOURCE_STYLE: Record<ProjectedDay["source"], string> = {
  not_started: "text-neutral-300 dark:text-neutral-700",
  ended: "text-neutral-300 dark:text-neutral-700",
  phases_complete: "text-neutral-400 dark:text-neutral-600 border-dashed",
  rest: "text-neutral-400 dark:text-neutral-600",
  template: "border-brand/30 bg-brand-fill/10",
  override: "border-amber-400/60 bg-amber-50 dark:bg-amber-950/40",
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CalendarMonthView({
  clientId,
  monthStart,
  days,
  exercises,
}: {
  clientId: string;
  monthStart: string;
  days: ProjectedDay[];
  exercises: Exercise[];
}) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dragError, setDragError] = useState<string | null>(null);
  const today = todayIso();
  const currentMonthKey = monthStart.slice(0, 7);

  const isEditable = (day: ProjectedDay) =>
    day.source !== "not_started" && day.source !== "ended" && day.date >= today;

  const onDrop = (toDate: string, e: React.DragEvent) => {
    e.preventDefault();
    const fromDate = e.dataTransfer.getData("text/plain");
    if (!fromDate || fromDate === toDate) return;
    setDragError(null);
    moveClientSessionToDate(clientId, fromDate, toDate).then((result) => {
      if (!result.ok) {
        setDragError(result.error);
        return;
      }
      router.refresh();
    });
  };

  const selectedDay = days.find((d) => d.date === selectedDate) ?? null;

  return (
    <div className="space-y-2">
      {dragError ? <p className="text-sm text-red-600">{dragError}</p> : null}
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
              draggable={editable}
              onDragStart={(e) => e.dataTransfer.setData("text/plain", day.date)}
              onDragOver={(e) => editable && e.preventDefault()}
              onDrop={(e) => editable && onDrop(day.date, e)}
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
              ) : day.exercises.length > 0 ? (
                <div className="mt-1 space-y-0.5">
                  <p className="truncate font-medium">{day.sessionName ?? "Session"}</p>
                  <p className="text-neutral-500">
                    {day.exercises.length} exercise{day.exercises.length === 1 ? "" : "s"}
                  </p>
                </div>
              ) : (
                <p className="mt-1 text-neutral-400">Rest</p>
              )}
              {day.source === "override" ? <p className="mt-0.5 text-amber-700 dark:text-amber-400">Custom</p> : null}
            </button>
          );
        })}
      </div>

      {selectedDay ? (
        <DayEditorPanel
          clientId={clientId}
          day={selectedDay}
          exercises={exercises}
          onClose={() => setSelectedDate(null)}
        />
      ) : null}
    </div>
  );
}
