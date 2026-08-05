import Link from "next/link";
import { ExerciseForm } from "../ExerciseForm";

export default function NewExercisePage() {
  return (
    <div className="space-y-4">
      <Link href="/admin/content/exercises" className="text-sm text-neutral-500 hover:underline">
        ← Exercises
      </Link>
      <h2 className="text-lg font-semibold">New exercise</h2>
      <ExerciseForm mode="create" />
    </div>
  );
}
