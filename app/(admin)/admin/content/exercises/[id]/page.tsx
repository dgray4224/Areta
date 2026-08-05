import Link from "next/link";
import { notFound } from "next/navigation";
import { getExerciseAdmin } from "@/domains/exerciselibrary/service";
import { ExerciseForm } from "../ExerciseForm";
import type { ExerciseAdminInput } from "@/domains/exerciselibrary/schema";

export default async function ExerciseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const exercise = await getExerciseAdmin(id);
  if (!exercise) notFound();

  const defaultValues: Partial<ExerciseAdminInput> = {
    name: exercise.name,
    canonicalName: exercise.canonicalName,
    movementPattern: exercise.movementPattern,
    difficulty: exercise.difficulty,
    equipmentRequired: exercise.equipmentRequired,
    primaryMuscleGroups: exercise.primaryMuscleGroups,
    secondaryMuscleGroups: exercise.secondaryMuscleGroups,
    archetypeTags: exercise.archetypeTags,
    aliases: exercise.aliases,
    setupRequirements: exercise.setupRequirements,
    limitationTags: exercise.limitationTags,
    modality: exercise.modality ?? undefined,
    unilateral: exercise.unilateral,
    compound: exercise.compound,
    contraindicationNotes: exercise.contraindicationNotes ?? undefined,
    instructions: exercise.instructions ?? undefined,
    imageUrl: exercise.imageUrl ?? undefined,
    videoUrl: exercise.videoUrl ?? undefined,
    status: exercise.status,
  };

  return (
    <div className="space-y-4">
      <Link href="/admin/content/exercises" className="text-sm text-neutral-500 hover:underline">
        ← Exercises
      </Link>
      <h2 className="text-lg font-semibold">{exercise.name}</h2>
      <ExerciseForm mode="edit" exerciseId={exercise.id} defaultValues={defaultValues} />
    </div>
  );
}
