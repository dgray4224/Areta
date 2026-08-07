import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getClientWorkoutOverview,
  getClientProgramAssignment,
  listClientAssignmentHistory,
  getNextScheduledSession,
} from "@/domains/trainer/service";
import { listMyPrograms, getExercisesForTrainer } from "@/domains/trainerprogram/service";
import { sundayOfWeekContaining, addDays } from "@/domains/trainerprogram/calendar-projection";
import { getExercisesByIds } from "@/domains/exerciselibrary/service";
import { Card } from "@/platform/ui/Card";
import { EmptyState } from "@/platform/ui/EmptyState";
import { WorkoutItemCustomizer } from "./WorkoutItemCustomizer";
import { AddWorkoutItem } from "./AddWorkoutItem";
import { AssignedProgramPanel } from "./AssignedProgramPanel";
import { AssignProgramForm } from "./AssignProgramForm";
import { ApproveWorkoutPlanButton } from "./ApproveWorkoutPlanButton";
import { PastProgramsList } from "./PastProgramsList";
import type { WorkoutPlanItemView } from "@/domains/workoutplan/service";
import type { Exercise } from "@/domains/exerciselibrary/types";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatPrescription(item: WorkoutPlanItemView): string {
  if (item.durationMinutes !== null && item.repsMin === null && item.repsMax === null) {
    return item.cardioIntensity ? `${item.durationMinutes} min (${item.cardioIntensity})` : `${item.durationMinutes} min`;
  }

  const repsLabel =
    item.repsMin !== null && item.repsMax !== null
      ? item.repsMin === item.repsMax
        ? `${item.repsMin}`
        : `${item.repsMin}-${item.repsMax}`
      : item.reps !== null
        ? `${item.reps}`
        : "?";

  const intensitySuffix =
    item.intensityType === "rpe" && item.intensityValue
      ? ` @ RPE ${item.intensityValue}`
      : item.intensityType === "percent_1rm" && item.intensityValue
        ? ` @ ${item.intensityValue}%`
        : "";

  return `${item.sets ?? "?"} × ${repsLabel}${intensitySuffix}`;
}

export default async function ClientWorkoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ assignWarnings?: string }>;
}) {
  const { clientId } = await params;
  const { assignWarnings } = await searchParams;
  const [result, assignment, allPrograms, historyResult, nextSessionResult] = await Promise.all([
    getClientWorkoutOverview(clientId),
    getClientProgramAssignment(clientId),
    listMyPrograms(),
    listClientAssignmentHistory(clientId),
    getNextScheduledSession(clientId),
  ]);
  if (!result.ok) notFound();
  const { workoutPlan } = result.data;
  const publishedPrograms = allPrograms.filter((p) => p.status === "published");
  const history = historyResult.ok ? historyResult.data : [];
  const nextSession = nextSessionResult.ok ? nextSessionResult.data : null;

  const today = new Date().toISOString().slice(0, 10);
  const thisWeekStart = sundayOfWeekContaining(today);
  const thisWeekEnd = addDays(thisWeekStart, 6);

  let warnings: string[] = [];
  if (assignWarnings) {
    try {
      warnings = JSON.parse(assignWarnings);
    } catch {
      // Malformed query param -- ignore rather than error the page.
    }
  }

  return (
    <div className="space-y-6">
      <Link href={`/trainer/clients/${clientId}`} className="text-sm text-neutral-500 hover:underline">
        ← Back
      </Link>
      <h2 className="text-lg font-semibold">Workout program</h2>

      {warnings.length > 0 ? (
        <div className="space-y-1 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {warnings.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
        </div>
      ) : null}

      {assignment ? (
        <AssignedProgramPanel clientId={clientId} assignment={assignment} programs={publishedPrograms} />
      ) : (
        <Card>
          <p className="mb-2 text-sm font-medium">Assign one of your programs</p>
          <p className="mb-3 text-sm text-neutral-600 dark:text-neutral-400">
            Build a program under{" "}
            <Link href="/trainer/programs" className="underline">
              Your programs
            </Link>
            , then assign it here.
          </p>
          <AssignProgramForm clientId={clientId} programs={publishedPrograms} />
        </Card>
      )}

      {workoutPlan?.status === "draft" ? <ApproveWorkoutPlanButton clientId={clientId} /> : null}

      {history.length > 0 ? (
        <PastProgramsList clientId={clientId} history={history} programs={publishedPrograms} />
      ) : null}

      {!workoutPlan || workoutPlan.items.length === 0 ? (
        assignment ? (
          assignment.startsOn > today ? (
            // Consistent with the nutrition side's equivalent split
            // (2026-08-07, found via a real screenshot there): a program
            // that just hasn't started yet is a completely normal state,
            // not a failure -- distinguishing it from "nothing scheduled
            // this week" (a real program with a real gap) keeps this from
            // reading as broken.
            <EmptyState
              title={`Starts ${assignment.startsOn}`}
              description="A workout plan generates automatically once the program starts — nothing to do here yet."
            />
          ) : (
            <EmptyState
              title={`Nothing scheduled ${thisWeekStart} – ${thisWeekEnd}`}
              description={
                nextSession
                  ? `This program has no session in the rest of this week. Next one: ${nextSession.date}${nextSession.sessionName ? ` — ${nextSession.sessionName}` : ""}. See the calendar above for the full schedule.`
                  : "This program has no session in the rest of this week, and none in the next 30 days either — check the program's phases and sessions, or the calendar above."
              }
            />
          )
        ) : (
          <EmptyState title="No workout plan yet" description="Assign a program above to get started." />
        )
      ) : (
        <WorkoutPlanBody clientId={clientId} items={workoutPlan.items} status={workoutPlan.status} />
      )}
    </div>
  );
}

async function WorkoutPlanBody({
  clientId,
  items,
  status,
}: {
  clientId: string;
  items: WorkoutPlanItemView[];
  status: string;
}) {
  const exerciseIds = [...new Set(items.map((i) => i.exerciseId))];
  // getExercisesForTrainer, not getAllExercises -- this trainer's own
  // still-status:'review' submissions (created via the "Can't find it?
  // Add a new exercise" flow, same as the program builder and calendar
  // editor) need to show up here too, or a trainer who typed one in
  // while building a program would have to retype it to customize a
  // client's already-materialized plan item. Found 2026-08-07: this was
  // the one of four trainer-facing exercise pickers still on the
  // client's-own-app-scoped, active-only fetch.
  const [exercisesById, allExercises]: [Map<string, Exercise>, Exercise[]] = await Promise.all([
    getExercisesByIds(exerciseIds),
    getExercisesForTrainer(),
  ]);

  const byDay = new Map<number, WorkoutPlanItemView[]>();
  for (const item of items) {
    const arr = byDay.get(item.dayOfWeek) ?? [];
    arr.push(item);
    byDay.set(item.dayOfWeek, arr);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        {/* Was a plain "Active"/"draft" status pill -- confusing sitting
         * right above a single week's days when the program itself can
         * span several phases (2026-08-07, user feedback): this is only
         * ever the *current* week's split, not the whole program, so it
         * says that directly. The program's own Active/Upcoming status
         * moved to AssignedProgramPanel.tsx, next to the program name --
         * that's the thing actually worth a status pill. Draft is the
         * one status still worth flagging here: it means this week
         * hasn't been approved yet (see ApproveWorkoutPlanButton above),
         * which "current week split" alone wouldn't convey. */}
        <h3 className="text-sm font-medium text-neutral-500">Current week split</h3>
        {status === "draft" ? (
          <span className="inline-block rounded-full border border-amber-300 px-2.5 py-0.5 text-xs text-amber-700 dark:border-amber-800 dark:text-amber-400">
            Draft
          </span>
        ) : null}
      </div>
      {DAY_NAMES.map((dayName, dayIndex) => {
        const dayItems = (byDay.get(dayIndex) ?? []).sort((a, b) => a.sessionOrder - b.sessionOrder);
        if (dayItems.length === 0) return null;
        // <details>/<summary> instead of Card -- collapsed by default,
        // click to expand, same zero-JS pattern PastProgramsList.tsx
        // already uses for "Past programs" below. Requested 2026-08-07:
        // a week of fully-expanded days made this page long and busy;
        // collapsed headers give a clean day-by-day overview at a
        // glance, full detail still one click away.
        return (
          <details
            key={dayIndex}
            className="rounded-2xl border border-black/5 bg-card p-4 text-foreground dark:border-white/5"
          >
            <summary className="cursor-pointer select-none text-sm font-medium">
              {dayName}
              <span className="ml-2 font-normal text-neutral-500">
                {dayItems.length} exercise{dayItems.length === 1 ? "" : "s"}
              </span>
            </summary>
            <ul className="mt-3 space-y-2 text-sm">
              {dayItems.map((item) => (
                <li key={item.id} className="text-neutral-600 dark:text-neutral-400">
                  <div className="flex justify-between">
                    <span>{exercisesById.get(item.exerciseId)?.name ?? "—"}</span>
                    <span>{formatPrescription(item)}</span>
                  </div>
                  <WorkoutItemCustomizer clientId={clientId} itemId={item.id} exercises={allExercises} />
                </li>
              ))}
            </ul>
            <div className="mt-2">
              <AddWorkoutItem clientId={clientId} dayOfWeek={dayIndex} exercises={allExercises} />
            </div>
          </details>
        );
      })}
    </div>
  );
}
