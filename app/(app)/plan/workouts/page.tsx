import Link from "next/link";
import { requireUser } from "@/platform/auth/session";
import { EmptyState } from "@/platform/ui/EmptyState";
import { getWorkoutPlanForWeek, type WorkoutPlanItemView } from "@/domains/workoutplan/service";
import { getExercisesByIds } from "@/domains/exerciselibrary/service";
import { GenerateWorkoutPlanButton } from "./GenerateWorkoutPlanButton";
import { ApproveWorkoutPlanButton } from "./ApproveWorkoutPlanButton";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

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

export default async function WorkoutsPage() {
  const user = await requireUser();
  const plan = await getWorkoutPlanForWeek(user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <Link href="/plan/setup" className="text-sm text-neutral-500 hover:underline">
        ← Back to plan
      </Link>
      <h1 className="text-2xl font-semibold">Workout plan</h1>

      {!plan || plan.items.length === 0 ? (
        <EmptyState
          title="No workout plan yet"
          description="Approve your training parameters first, then generate a weekly schedule from the exercise library."
          action={<GenerateWorkoutPlanButton userId={user.id} />}
        />
      ) : (
        <WorkoutPlanBody userId={user.id} plan={plan} />
      )}
    </div>
  );
}

async function WorkoutPlanBody({
  userId,
  plan,
}: {
  userId: string;
  plan: NonNullable<Awaited<ReturnType<typeof getWorkoutPlanForWeek>>>;
}) {
  const exerciseIds = [...new Set(plan.items.map((i) => i.exerciseId))];
  const exercises = await getExercisesByIds(exerciseIds);

  const byDay = new Map<number, WorkoutPlanItemView[]>();
  for (const item of plan.items) {
    const arr = byDay.get(item.dayOfWeek) ?? [];
    arr.push(item);
    byDay.set(item.dayOfWeek, arr);
  }

  return (
    <>
      {plan.programContext ? (
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {plan.programContext.programName} · {plan.programContext.phaseName}, Week {plan.programContext.phaseWeekNumber}
        </p>
      ) : null}

      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {plan.sessionsPerWeek} sessions/week
          {plan.phaseFocus ? ` · ${plan.phaseFocus}` : ""}
        </p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
            plan.status === "active"
              ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
              : "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
          }`}
        >
          {plan.status === "active" ? "Active" : "Draft"}
        </span>
      </div>

      <div className="space-y-4">
        {Array.from({ length: 7 }, (_, day) => day).map((day) => {
          const items = (byDay.get(day) ?? []).slice().sort((a, b) => a.sessionOrder - b.sessionOrder);
          return (
            <div
              key={day}
              className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
            >
              <p className="font-medium">{DAY_NAMES[day]}</p>
              {items.length === 0 ? (
                <p className="mt-2 text-sm text-neutral-400">Rest day</p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm">
                  {items.map((item) => {
                    const exercise = exercises.get(item.exerciseId);
                    return (
                      <li key={item.id} className="flex flex-col gap-0.5">
                        <div className="flex justify-between gap-4">
                          <span>
                            {exercise?.name ?? "Unknown exercise"}
                            {item.substituted ? (
                              <span className="ml-2 rounded-full bg-neutral-200 px-1.5 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                                swapped for your equipment
                              </span>
                            ) : null}
                          </span>
                          <span className="shrink-0 text-neutral-400">{formatPrescription(item)}</span>
                        </div>
                        {item.coachingNotes ? (
                          <p className="text-xs text-neutral-400">{item.coachingNotes}</p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        <GenerateWorkoutPlanButton userId={userId} label="Regenerate plan" />
        {plan.status !== "active" ? <ApproveWorkoutPlanButton userId={userId} /> : null}
      </div>
    </>
  );
}
