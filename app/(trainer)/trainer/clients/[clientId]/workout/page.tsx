import Link from "next/link";
import { notFound } from "next/navigation";
import { getClientWorkoutOverview, generateClientWorkoutPlan, approveClientWorkoutPlan } from "@/domains/trainer/service";
import { getExercisesByIds } from "@/domains/exerciselibrary/service";
import { Card } from "@/platform/ui/Card";
import { EmptyState } from "@/platform/ui/EmptyState";
import { PlanActions } from "../PlanActions";
import type { WorkoutPlanItemView } from "@/domains/workoutplan/service";

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

export default async function ClientWorkoutPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const result = await getClientWorkoutOverview(clientId);
  if (!result.ok) notFound();
  const { workoutPlan } = result.data;

  return (
    <div className="space-y-6">
      <Link href={`/trainer/clients/${clientId}`} className="text-sm text-neutral-500 hover:underline">
        ← Back
      </Link>
      <h2 className="text-lg font-semibold">Workout program</h2>

      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Generating pulls from the same training-program library your client&apos;s own plan would use.
        Swapping individual exercises isn&apos;t available here yet — regenerate for a new program, or
        have your client swap from their own Workout plan screen.
      </p>

      <PlanActions
        clientId={clientId}
        hasDraft={workoutPlan?.status === "draft"}
        onGenerate={generateClientWorkoutPlan}
        onApprove={approveClientWorkoutPlan}
        generateLabel={workoutPlan ? "Regenerate plan" : "Generate workout plan"}
        approveLabel="Approve plan"
      />

      {!workoutPlan || workoutPlan.items.length === 0 ? (
        <EmptyState title="No workout plan yet" description="Generate one above." />
      ) : (
        <WorkoutPlanBody items={workoutPlan.items} status={workoutPlan.status} />
      )}
    </div>
  );
}

async function WorkoutPlanBody({
  items,
  status,
}: {
  items: WorkoutPlanItemView[];
  status: string;
}) {
  const exerciseIds = [...new Set(items.map((i) => i.exerciseId))];
  const exercisesById = await getExercisesByIds(exerciseIds);

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
            <ul className="space-y-1 text-sm">
              {dayItems.map((item) => (
                <li key={item.id} className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>{exercisesById.get(item.exerciseId)?.name ?? "—"}</span>
                  <span>{formatPrescription(item)}</span>
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
