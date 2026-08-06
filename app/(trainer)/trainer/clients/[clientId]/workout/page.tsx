import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getClientWorkoutOverview,
  generateClientWorkoutPlan,
  approveClientWorkoutPlan,
  getClientProgramAssignment,
} from "@/domains/trainer/service";
import { listMyPrograms } from "@/domains/trainerprogram/service";
import { getExercisesByIds, getAllExercises } from "@/domains/exerciselibrary/service";
import { Card } from "@/platform/ui/Card";
import { EmptyState } from "@/platform/ui/EmptyState";
import { PlanActions } from "../PlanActions";
import { WorkoutItemCustomizer } from "./WorkoutItemCustomizer";
import { AddWorkoutItem } from "./AddWorkoutItem";
import { AssignedProgramPanel } from "./AssignedProgramPanel";
import { AssignProgramForm } from "./AssignProgramForm";
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
  const [result, assignment, allPrograms] = await Promise.all([
    getClientWorkoutOverview(clientId),
    getClientProgramAssignment(clientId),
    listMyPrograms(),
  ]);
  if (!result.ok) notFound();
  const { workoutPlan } = result.data;
  const publishedPrograms = allPrograms.filter((p) => p.status === "published");

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
            Write and reuse your own programs at{" "}
            <Link href="/trainer/programs" className="underline">
              Your programs
            </Link>
            . Once assigned, this client&apos;s weekly plan is generated straight from it — no need to fall back to
            the library generator below.
          </p>
          <AssignProgramForm clientId={clientId} programs={publishedPrograms} />
        </Card>
      )}

      <details className="text-sm text-neutral-500">
        <summary className="cursor-pointer select-none">
          {workoutPlan ? "Library-generated plan options" : "Or generate from the shared library instead"}
        </summary>
        <div className="mt-3 space-y-3">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Pulls from the same training-program library your client&apos;s own onboarding-driven plan would use.
            {assignment
              ? " Blocked automatically while a program is assigned above (unassign it first) — the two would otherwise silently overwrite each other's draft for the same week."
              : ""}
          </p>
          <PlanActions
            clientId={clientId}
            hasDraft={workoutPlan?.status === "draft"}
            onGenerate={generateClientWorkoutPlan}
            onApprove={approveClientWorkoutPlan}
            generateLabel={workoutPlan ? "Regenerate plan" : "Generate workout plan"}
            approveLabel="Approve plan"
            disableGenerate={assignment !== null}
            disabledReason="Unassign the trainer-authored program above first."
          />
        </div>
      </details>

      {!workoutPlan || workoutPlan.items.length === 0 ? (
        <EmptyState
          title="No workout plan yet"
          description="Assign a program above, or generate one from the library."
        />
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
  const [exercisesById, allExercises]: [Map<string, Exercise>, Exercise[]] = await Promise.all([
    getExercisesByIds(exerciseIds),
    getAllExercises(),
  ]);

  const byDay = new Map<number, WorkoutPlanItemView[]>();
  for (const item of items) {
    const arr = byDay.get(item.dayOfWeek) ?? [];
    arr.push(item);
    byDay.set(item.dayOfWeek, arr);
  }

  return (
    <div className="space-y-3">
      <span className="inline-block rounded-full border border-neutral-300 px-2.5 py-0.5 text-xs capitalize text-neutral-500 dark:border-neutral-700">
        {status}
      </span>
      {DAY_NAMES.map((dayName, dayIndex) => {
        const dayItems = (byDay.get(dayIndex) ?? []).sort((a, b) => a.sessionOrder - b.sessionOrder);
        if (dayItems.length === 0) return null;
        return (
          <Card key={dayIndex}>
            <p className="mb-2 text-sm font-medium">{dayName}</p>
            <ul className="space-y-2 text-sm">
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
          </Card>
        );
      })}
    </div>
  );
}
