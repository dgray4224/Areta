import { Card } from "@/platform/ui/Card";
import type { UpcomingEvent } from "@/domains/calendar/schema";
import type { TimelineEventView } from "@/domains/timeline/service";

type ScheduledRow = { id: string; title: string; time: string; sortMinutes: number; source: "calendar" | "custom" };
type UnscheduledRow = { id: string; title: string; detail: string | null; source: "meal" | "workout" | "custom" };

function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** "HH:MM:SS" (custom_timeline_events' scheduled_time column) -> minutes
 * since midnight, for sorting alongside calendar events' ISO timestamps. */
function sqlTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function formatSqlTime(time: string): string {
  const minutes = sqlTimeToMinutes(time);
  const d = new Date();
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d.toLocaleString(undefined, { hour: "numeric", minute: "2-digit" });
}

/**
 * Desktop Dashboard's read-only two-pane "day's shape" view — the ported
 * concept from areta-mobile's AtAGlanceTimeline (Schedule + Unscheduled
 * columns), minus drag-and-drop for this first pass (see the redesign
 * spec's "Phase 2" decision: static now, real DnD as a fast-follow once
 * this layout itself is confirmed). Calendar events are always read-only
 * even on mobile; meals/workouts/custom events are the ones that will
 * become draggable later — for now everything here is display-only.
 */
export function ScheduleTimeline({
  date,
  calendarEvents,
  meals,
  workout,
  customEvents,
}: {
  date: string;
  calendarEvents: UpcomingEvent[];
  meals: { mealType: string; recipeName: string }[];
  workout: { hasActivePlan: boolean; exercises: { name: string; sets: number | null; reps: number | null; durationMinutes: number | null }[] };
  customEvents: TimelineEventView[];
}) {
  const scheduled: ScheduledRow[] = [
    ...calendarEvents
      .filter((e) => !e.allDay)
      .map((e) => ({
        id: `cal-${e.id}`,
        title: e.title,
        time: formatClockTime(e.startsAt),
        sortMinutes: new Date(e.startsAt).getHours() * 60 + new Date(e.startsAt).getMinutes(),
        source: "calendar" as const,
      })),
    ...customEvents
      .filter((e) => e.scheduledTime)
      .map((e) => ({
        id: `custom-${e.id}`,
        title: e.title,
        time: formatSqlTime(e.scheduledTime as string),
        sortMinutes: sqlTimeToMinutes(e.scheduledTime as string),
        source: "custom" as const,
      })),
  ].sort((a, b) => a.sortMinutes - b.sortMinutes);

  const allDayEvents = calendarEvents.filter((e) => e.allDay);

  const unscheduled: UnscheduledRow[] = [
    ...meals.map((m, i) => ({
      id: `meal-${i}`,
      title: m.recipeName,
      detail: m.mealType,
      source: "meal" as const,
    })),
    ...(workout.hasActivePlan
      ? [
          {
            id: "workout",
            title: workout.exercises.length > 0 ? `Workout — ${workout.exercises.length} exercise${workout.exercises.length === 1 ? "" : "s"}` : "Rest day",
            detail: workout.exercises.length > 0 ? workout.exercises.map((e) => e.name).join(", ") : null,
            source: "workout" as const,
          },
        ]
      : []),
    ...customEvents
      .filter((e) => !e.scheduledTime)
      .map((e) => ({ id: `custom-${e.id}`, title: e.title, detail: e.notes, source: "custom" as const })),
  ];

  const isEmpty = scheduled.length === 0 && allDayEvents.length === 0 && unscheduled.length === 0;

  if (isEmpty) {
    return (
      <Card tone="surface">
        <p className="text-sm text-neutral-500">Nothing planned for {date === todayDateString() ? "today" : "this day"} yet.</p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <h2 className="text-sm font-medium text-neutral-500">Schedule</h2>
        <div className="mt-2 space-y-1.5">
          {allDayEvents.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 rounded-lg bg-accent/10 px-3 py-2 text-sm">
              <span className="truncate">{e.title}</span>
              <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-accent">All day</span>
            </div>
          ))}
          {scheduled.length > 0 ? (
            scheduled.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-black/5 bg-card px-3 py-2 text-sm dark:border-white/5"
              >
                <span className="truncate">{row.title}</span>
                <span className="shrink-0 tabular-nums text-neutral-400">{row.time}</span>
              </div>
            ))
          ) : allDayEvents.length === 0 ? (
            <p className="rounded-lg border border-dashed border-neutral-300 px-3 py-4 text-center text-xs text-neutral-400 dark:border-neutral-700">
              Nothing at a fixed time yet
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium text-neutral-500">Unscheduled</h2>
        <div className="mt-2 space-y-1.5">
          {unscheduled.length > 0 ? (
            unscheduled.map((row) => (
              <div key={row.id} className="rounded-lg border border-black/5 bg-card px-3 py-2 text-sm dark:border-white/5">
                <p className="truncate">{row.title}</p>
                {row.detail ? <p className="mt-0.5 truncate text-xs text-neutral-400">{row.detail}</p> : null}
              </div>
            ))
          ) : (
            <p className="rounded-lg border border-dashed border-neutral-300 px-3 py-4 text-center text-xs text-neutral-400 dark:border-neutral-700">
              All caught up
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}
