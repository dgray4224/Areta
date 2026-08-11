"use client";

import { useRef, useState, useTransition } from "react";
import type { UpcomingEvent } from "@/domains/calendar/schema";
import type { TimelineEventView } from "@/domains/timeline/service";
import type { CreateTimelineEventInput } from "@/domains/timeline/schema";
import {
  createTimelineEvent,
  setTimelineEventScheduledTime,
  setTimelineEventCompleted,
  setTimelineEventNotes,
  deleteTimelineEvent,
} from "@/domains/timeline/service";
import { setMealPlanItemScheduledTime } from "@/domains/mealplan/service";
import { setWorkoutPlanItemScheduledTime } from "@/domains/workoutplan/service";
import { AddTaskModal } from "./AddTaskModal";

const HOUR_HEIGHT = 56;
const DEFAULT_RANGE_START_MIN = 6 * 60; // 06:00
const DEFAULT_RANGE_END_MIN = 22 * 60; // 22:00
const SNAP_MINUTES = 15;
// Tap-from-tray placement defaults, same values as areta-mobile's
// AtAGlanceTimeline.tsx (MEAL_DEFAULT_BUCKETS / TRAY_PLACE_MINUTES) —
// meals land on their bucket's midpoint, workout lands at noon.
const MEAL_DEFAULT_BUCKETS: Record<string, { start: number; end: number }> = {
  breakfast: { start: 5 * 60, end: 10 * 60 },
  lunch: { start: 11 * 60, end: 14 * 60 },
  dinner: { start: 17 * 60, end: 20 * 60 },
  snack: { start: 14 * 60, end: 17 * 60 },
};
const TRAY_PLACE_MINUTES = 12 * 60;
// A drag that never moves more than this many pixels counts as a click,
// not a reschedule -- lets a custom-task block stay tappable-to-open
// without needing a separate non-draggable hit target.
const CLICK_THRESHOLD_PX = 4;

export type TimelineMeal = { id: string; mealType: string; recipeName: string; scheduledTime: string | null };
export type TimelineWorkout = { hasActivePlan: boolean; scheduledTime: string | null; exerciseCount: number; itemIds: string[] };

function parseTimeToMinutes(time: string | null): number | null {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function timeStringFor(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:00`;
}

function formatMinutes(minutes: number): string {
  const d = new Date();
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d.toLocaleString(undefined, { hour: "numeric", minute: "2-digit" });
}

function isPointInRect(x: number, y: number, rect: DOMRect): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

type Block = {
  id: string;
  refId: string; // underlying meal item id / "workout" sentinel / custom event id -- draggable/reschedulable target
  kind: "calendar" | "meal" | "workout" | "custom";
  label: string;
  startMinutes: number;
  durationMinutes: number;
};

// Same "solid outline, lightly tinted fill" idiom as areta-mobile's
// AtAGlanceTimeline.tsx blockColors(), reusing the app's existing brand
// tokens for meal/workout (same semantic mapping mobile uses: accent for
// meal, brand for workout) and the unused chart series-2 blue for
// tasks — validated CVD-distinct from brand/accent by the dataviz
// skill's palette, and not claimed by any chart on this page.
const KIND_COLOR: Record<Block["kind"], string> = {
  calendar: "#8e8e93",
  meal: "var(--color-accent)",
  workout: "var(--color-brand)",
  custom: "var(--chart-series-2)",
};

/**
 * Visual hour-by-hour schedule grid — ports areta-mobile's
 * AtAGlanceTimeline.tsx concept: a merged Schedule lane (calendar events,
 * read-only, plus meal/workout/custom, all draggable once they have a
 * real time) alongside an Unscheduled tray for anything without one yet.
 *
 * Drag mechanics use native Pointer Events + pointer capture (no DnD
 * library in this repo) rather than react-native-gesture-handler's Pan
 * gesture mobile uses — capturing the pointer on the block itself means
 * onPointerMove/Up keep firing on that element even once the cursor
 * leaves its bounds, so no document-level listeners are needed. Dropping
 * a block over the Unscheduled tray unschedules it (mirrors mobile's
 * drag-past-a-threshold-to-remove gesture, just position-based instead
 * of distance-based since there's a real drop target here). A meal/
 * workout item with no time yet has no draggable position at all, so
 * tapping its Unscheduled chip places it at a sensible default first
 * (bucket midpoint for meals, noon for workout) — same two-step
 * tap-then-drag flow mobile's tray uses.
 *
 * Calendar events stay read-only (synced from an external account, same
 * as mobile). Meal/workout completion, notes, and swap still live in the
 * Nutrition/Exercise sections below — only scheduling moved here.
 */
export function DayTimeline({
  userId,
  date,
  wakeTime,
  bedTime,
  calendarEvents,
  meals,
  workout,
  customEvents,
}: {
  userId: string;
  date: string;
  wakeTime: string | null;
  bedTime: string | null;
  calendarEvents: UpcomingEvent[];
  meals: TimelineMeal[];
  workout: TimelineWorkout;
  customEvents: TimelineEventView[];
}) {
  const [mealItems, setMealItems] = useState(meals);
  const [workoutTime, setWorkoutTime] = useState(workout.scheduledTime);
  const [events, setEvents] = useState(customEvents);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [isPending, startTransition] = useTransition();

  const [dragId, setDragId] = useState<string | null>(null);
  const [dragDeltaY, setDragDeltaY] = useState(0);
  const dragStartYRef = useRef(0);
  const trayRef = useRef<HTMLDivElement>(null);

  const selected = events.find((e) => e.id === selectedId) ?? null;

  let rangeStart = parseTimeToMinutes(wakeTime) ?? DEFAULT_RANGE_START_MIN;
  let rangeEnd = parseTimeToMinutes(bedTime) ?? DEFAULT_RANGE_END_MIN;
  if (rangeEnd <= rangeStart) {
    rangeStart = DEFAULT_RANGE_START_MIN;
    rangeEnd = DEFAULT_RANGE_END_MIN;
  }
  const gridHeight = ((rangeEnd - rangeStart) / 60) * HOUR_HEIGHT;
  const topForMinutes = (minutes: number) => ((minutes - rangeStart) / 60) * HOUR_HEIGHT;
  const clampMinutes = (minutes: number) => Math.max(rangeStart, Math.min(rangeEnd - SNAP_MINUTES, minutes));

  const hours: number[] = [];
  for (let h = Math.floor(rangeStart / 60); h <= Math.ceil(rangeEnd / 60); h++) hours.push(h);

  const calendarBlocks: Block[] = calendarEvents
    .filter((e) => !e.allDay)
    .map((e) => {
      const start = new Date(e.startsAt);
      const end = new Date(e.endsAt);
      const startMinutes = start.getHours() * 60 + start.getMinutes();
      const endMinutes = end.getHours() * 60 + end.getMinutes();
      return {
        id: `cal-${e.id}`,
        refId: e.id,
        kind: "calendar" as const,
        label: e.title,
        startMinutes,
        durationMinutes: Math.max(15, endMinutes - startMinutes),
      };
    });

  const scheduledMeals = mealItems.filter((m) => parseTimeToMinutes(m.scheduledTime) !== null);
  const unscheduledMeals = mealItems.filter((m) => parseTimeToMinutes(m.scheduledTime) === null);
  const mealBlocks: Block[] = scheduledMeals.map((m) => ({
    id: `meal-${m.id}`,
    refId: m.id,
    kind: "meal" as const,
    label: m.mealType.charAt(0).toUpperCase() + m.mealType.slice(1),
    startMinutes: parseTimeToMinutes(m.scheduledTime) as number,
    durationMinutes: 30,
  }));

  const workoutScheduledMinutes = parseTimeToMinutes(workoutTime);
  const workoutBlocks: Block[] =
    workout.hasActivePlan && workoutScheduledMinutes !== null
      ? [
          {
            id: "workout",
            refId: "workout",
            kind: "workout" as const,
            label: workout.exerciseCount > 1 ? `Workout (${workout.exerciseCount} exercises)` : "Workout",
            startMinutes: workoutScheduledMinutes,
            durationMinutes: 45,
          },
        ]
      : [];
  const workoutUnscheduled = workout.hasActivePlan && workoutScheduledMinutes === null;

  const scheduledEvents = events.filter((e) => parseTimeToMinutes(e.scheduledTime) !== null);
  const unscheduledEvents = events.filter((e) => parseTimeToMinutes(e.scheduledTime) === null);
  const customBlocks: Block[] = scheduledEvents.map((e) => {
    const startMinutes = parseTimeToMinutes(e.scheduledTime) as number;
    const endMinutes = parseTimeToMinutes(e.endTime);
    return {
      id: e.id,
      refId: e.id,
      kind: "custom" as const,
      label: e.title,
      startMinutes,
      durationMinutes: endMinutes !== null && endMinutes > startMinutes ? endMinutes - startMinutes : 30,
    };
  });

  const allBlocks = [...calendarBlocks, ...mealBlocks, ...workoutBlocks, ...customBlocks].sort(
    (a, b) => a.startMinutes - b.startMinutes
  );

  // Same simple overlap-stacking as mobile's AtAGlanceTimeline — not real
  // bin-packing, fine at expected per-day item density.
  const overlapIndexById = new Map<string, number>();
  const activeEnds: number[] = [];
  for (const block of allBlocks) {
    while (activeEnds.length > 0 && activeEnds[0] <= block.startMinutes) activeEnds.shift();
    overlapIndexById.set(block.id, activeEnds.length);
    activeEnds.push(block.startMinutes + block.durationMinutes);
    activeEnds.sort((a, b) => a - b);
  }

  const isEmpty = allBlocks.length === 0 && unscheduledMeals.length === 0 && !workoutUnscheduled && unscheduledEvents.length === 0;

  function openTask(id: string) {
    const task = events.find((e) => e.id === id);
    setSelectedId(id);
    setNotesDraft(task?.notes ?? "");
  }

  // ---- Reschedule primitives, one per kind, each optimistic-then-sync ----

  function rescheduleMeal(mealId: string, minutes: number | null) {
    const time = minutes === null ? null : timeStringFor(minutes);
    setMealItems((prev) => prev.map((m) => (m.id === mealId ? { ...m, scheduledTime: time } : m)));
    startTransition(async () => {
      await setMealPlanItemScheduledTime(userId, mealId, time);
    });
  }

  function rescheduleWorkout(minutes: number | null) {
    const time = minutes === null ? null : timeStringFor(minutes);
    setWorkoutTime(time);
    startTransition(async () => {
      await Promise.all(workout.itemIds.map((id) => setWorkoutPlanItemScheduledTime(userId, id, time)));
    });
  }

  function rescheduleCustom(taskId: string, minutes: number | null) {
    const time = minutes === null ? null : timeStringFor(minutes);
    setEvents((prev) => prev.map((e) => (e.id === taskId ? { ...e, scheduledTime: time, endTime: minutes === null ? null : e.endTime } : e)));
    startTransition(async () => {
      await setTimelineEventScheduledTime(userId, taskId, time);
    });
  }

  function reschedule(block: Block, minutes: number | null) {
    if (block.kind === "meal") rescheduleMeal(block.refId, minutes);
    else if (block.kind === "workout") rescheduleWorkout(minutes);
    else if (block.kind === "custom") rescheduleCustom(block.refId, minutes);
  }

  // ---- Drag handlers (meal/workout/custom only, not calendar) ----

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>, block: Block) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartYRef.current = e.clientY;
    setDragId(block.id);
    setDragDeltaY(0);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (dragId === null) return;
    setDragDeltaY(e.clientY - dragStartYRef.current);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLButtonElement>, block: Block) {
    if (dragId !== block.id) return;
    const deltaY = e.clientY - dragStartYRef.current;
    setDragId(null);
    setDragDeltaY(0);

    if (Math.abs(deltaY) < CLICK_THRESHOLD_PX) {
      if (block.kind === "custom") openTask(block.refId);
      return;
    }

    const overTray = trayRef.current ? isPointInRect(e.clientX, e.clientY, trayRef.current.getBoundingClientRect()) : false;
    if (overTray) {
      reschedule(block, null);
      return;
    }
    const rawMinutes = block.startMinutes + (deltaY / HOUR_HEIGHT) * 60;
    const snapped = clampMinutes(Math.round(rawMinutes / SNAP_MINUTES) * SNAP_MINUTES);
    reschedule(block, snapped);
  }

  function handlePointerCancel() {
    setDragId(null);
    setDragDeltaY(0);
  }

  function mealDefaultMinutes(mealType: string): number {
    const bucket = MEAL_DEFAULT_BUCKETS[mealType] ?? { start: 12 * 60, end: 13 * 60 };
    return Math.round((bucket.start + bucket.end) / 2);
  }

  // ---- Custom task CRUD (unchanged from before drag support) ----

  function onCreateTask(input: CreateTimelineEventInput) {
    startTransition(async () => {
      const result = await createTimelineEvent(userId, input);
      if (result.ok) setEvents((prev) => [...prev, result.data]);
    });
  }

  function onToggleComplete(task: TimelineEventView) {
    startTransition(async () => {
      const result = await setTimelineEventCompleted(userId, task.id, !task.completedAt);
      if (result.ok) {
        setEvents((prev) =>
          prev.map((e) => (e.id === task.id ? { ...e, completedAt: task.completedAt ? null : new Date().toISOString() } : e))
        );
      }
    });
  }

  function onSaveNotes(taskId: string) {
    startTransition(async () => {
      const trimmed = notesDraft.trim() || null;
      const result = await setTimelineEventNotes(userId, taskId, trimmed);
      if (result.ok) setEvents((prev) => prev.map((e) => (e.id === taskId ? { ...e, notes: trimmed } : e)));
    });
  }

  function onDelete(taskId: string) {
    startTransition(async () => {
      const result = await deleteTimelineEvent(userId, taskId);
      if (result.ok) {
        setEvents((prev) => prev.filter((e) => e.id !== taskId));
        setSelectedId(null);
      }
    });
  }

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-neutral-500">Schedule</h2>
          <p className="mt-0.5 text-xs text-neutral-400">
            Tasks are personal to-dos — errands, work blocks, anything you want on today&apos;s
            calendar that isn&apos;t a planned meal or workout. Drag anything onto the grid to set
            its time, or back onto Unscheduled to clear it.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="shrink-0 rounded-full border border-brand px-3 py-1 text-xs font-semibold text-brand hover:bg-brand/5"
        >
          + Add task
        </button>
      </div>

      {isEmpty ? (
        <p className="rounded-lg border border-dashed border-neutral-300 px-3 py-6 text-center text-sm text-neutral-400 dark:border-neutral-700">
          Nothing planned for today yet.
        </p>
      ) : (
        <div className="flex">
          <div className="flex-1 overflow-y-auto rounded-lg border border-black/5 dark:border-white/5" style={{ maxHeight: 380 }}>
            <div className="flex" style={{ height: gridHeight + 16 }}>
              <div className="relative w-10 shrink-0">
                {hours.map((h) => (
                  <span
                    key={h}
                    className="absolute -translate-y-1/2 text-[11px] text-neutral-400"
                    style={{ top: topForMinutes(h * 60) + 8 }}
                  >
                    {h % 12 === 0 ? 12 : h % 12}
                    {h < 12 ? "am" : "pm"}
                  </span>
                ))}
              </div>
              <div className="relative flex-1">
                {hours.map((h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-black/5 dark:border-white/5"
                    style={{ top: topForMinutes(h * 60) + 8 }}
                  />
                ))}
                {allBlocks.map((block) => {
                  const overlapIndex = overlapIndexById.get(block.id) ?? 0;
                  const color = KIND_COLOR[block.kind];
                  const draggable = block.kind !== "calendar";
                  const isDragging = dragId === block.id;
                  return (
                    <button
                      key={block.id}
                      type="button"
                      title={block.label}
                      onPointerDown={draggable ? (e) => handlePointerDown(e, block) : undefined}
                      onPointerMove={draggable ? handlePointerMove : undefined}
                      onPointerUp={draggable ? (e) => handlePointerUp(e, block) : undefined}
                      onPointerCancel={draggable ? handlePointerCancel : undefined}
                      className="absolute touch-none overflow-hidden rounded-md border px-2 py-1 text-left text-xs"
                      style={{
                        top: topForMinutes(block.startMinutes) + 8 + (isDragging ? dragDeltaY : 0),
                        height: Math.max(22, (block.durationMinutes / 60) * HOUR_HEIGHT),
                        left: 4 + overlapIndex * 14,
                        right: 4,
                        backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)`,
                        borderColor: color,
                        cursor: draggable ? (isDragging ? "grabbing" : "grab") : "default",
                        zIndex: isDragging ? 20 : undefined,
                      }}
                    >
                      <span className="line-clamp-2 text-neutral-900 dark:text-neutral-50">{block.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div ref={trayRef} className="ml-2 w-28 shrink-0 space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">Unscheduled</p>
            {unscheduledMeals.map((m) => (
              <button
                key={m.id}
                type="button"
                title={m.recipeName}
                onClick={() => rescheduleMeal(m.id, mealDefaultMinutes(m.mealType))}
                className="block w-full truncate rounded-full border px-2 py-1 text-center text-[11px]"
                style={{ borderColor: KIND_COLOR.meal, backgroundColor: `color-mix(in srgb, ${KIND_COLOR.meal} 14%, transparent)` }}
              >
                {m.mealType.charAt(0).toUpperCase() + m.mealType.slice(1)}
              </button>
            ))}
            {workoutUnscheduled ? (
              <button
                type="button"
                onClick={() => rescheduleWorkout(TRAY_PLACE_MINUTES)}
                className="block w-full truncate rounded-full border px-2 py-1 text-center text-[11px]"
                style={{ borderColor: KIND_COLOR.workout, backgroundColor: `color-mix(in srgb, ${KIND_COLOR.workout} 14%, transparent)` }}
              >
                Workout
              </button>
            ) : null}
            {unscheduledEvents.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => openTask(e.id)}
                title={e.title}
                className="block w-full truncate rounded-full border px-2 py-1 text-center text-[11px]"
                style={{ borderColor: KIND_COLOR.custom, backgroundColor: `color-mix(in srgb, ${KIND_COLOR.custom} 14%, transparent)` }}
              >
                {e.title}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="block w-full rounded-full border border-dashed border-brand px-2 py-1 text-center text-[11px] font-semibold text-brand"
            >
              + Add
            </button>
          </div>
        </div>
      )}

      {selected ? (
        <div className="mt-3 rounded-lg border border-black/5 bg-card p-3 dark:border-white/5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <button
                type="button"
                onClick={() => onToggleComplete(selected)}
                aria-label={selected.completedAt ? "Mark not done" : "Mark done"}
                className={`mt-0.5 h-5 w-5 shrink-0 rounded-md border-2 ${
                  selected.completedAt ? "border-accent bg-accent" : "border-neutral-300 dark:border-neutral-700"
                }`}
              />
              <div>
                <p className={`text-sm font-medium ${selected.completedAt ? "text-neutral-400 line-through" : ""}`}>
                  {selected.title}
                </p>
                <p className="text-xs text-neutral-500">
                  {selected.scheduledTime ? formatMinutes(parseTimeToMinutes(selected.scheduledTime) as number) : "Unscheduled"}
                </p>
              </div>
            </div>
            <button type="button" onClick={() => setSelectedId(null)} className="text-xs text-neutral-500">
              Close
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-neutral-500">
              Time
              <input
                type="time"
                value={selected.scheduledTime?.slice(0, 5) ?? ""}
                onChange={(e) => rescheduleCustom(selected.id, e.target.value ? parseTimeToMinutes(`${e.target.value}:00`) : null)}
                className="rounded-md border border-neutral-300 bg-card px-2 py-1 text-xs dark:border-neutral-700"
              />
            </label>
            <button
              type="button"
              onClick={() => onDelete(selected.id)}
              disabled={isPending}
              className="text-xs font-medium text-red-600 dark:text-red-400"
            >
              Delete
            </button>
          </div>

          <div className="mt-2 flex gap-2">
            <input
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              placeholder="Add a note…"
              className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-card px-2 py-1 text-sm dark:border-neutral-700"
            />
            <button type="button" onClick={() => onSaveNotes(selected.id)} disabled={isPending} className="text-xs font-medium text-brand">
              Save
            </button>
          </div>
        </div>
      ) : null}

      <AddTaskModal open={addOpen} date={date} onClose={() => setAddOpen(false)} onCreate={onCreateTask} />
    </div>
  );
}
