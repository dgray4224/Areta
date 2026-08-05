import Link from "next/link";
import { listExercisesAdmin } from "@/domains/exerciselibrary/service";
import type { ExerciseStatus } from "@/domains/exerciselibrary/types";
import { Card } from "@/platform/ui/Card";
import { EmptyState } from "@/platform/ui/EmptyState";
import { LinkButton } from "@/platform/ui/Button";
import { StatusTabs } from "../../StatusTabs";

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "review", label: "Review" },
  { value: "deprecated", label: "Deprecated" },
] as const;

export default async function ExercisesAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const exercises = await listExercisesAdmin(
    status && status !== "all" ? (status as ExerciseStatus) : undefined
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <StatusTabs basePath="/admin/content/exercises" options={STATUS_OPTIONS} current={status ?? "all"} />
        <LinkButton href="/admin/content/exercises/new" variant="secondary">
          + New exercise
        </LinkButton>
      </div>

      {exercises.length === 0 ? (
        <EmptyState title="No exercises here" description="Nothing matches this filter yet." />
      ) : (
        <div className="space-y-2">
          {exercises.map((exercise) => (
            <Link key={exercise.id} href={`/admin/content/exercises/${exercise.id}`}>
              <Card className="flex items-center justify-between hover:border-brand/40">
                <div>
                  <p className="font-medium">{exercise.name}</p>
                  <p className="text-xs text-neutral-500">
                    {exercise.movementPattern} · {exercise.difficulty}
                    {exercise.primaryMuscleGroups.length > 0
                      ? ` · ${exercise.primaryMuscleGroups.join(", ")}`
                      : ""}
                  </p>
                </div>
                <span className="rounded-full border border-neutral-300 px-2.5 py-0.5 text-xs capitalize text-neutral-500 dark:border-neutral-700">
                  {exercise.status}
                </span>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
