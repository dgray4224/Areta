import Link from "next/link";
import { notFound } from "next/navigation";
import { getProgramWithPhases, getPhaseHydrated, getExercisesForTrainer } from "@/domains/trainerprogram/service";
import { Card } from "@/platform/ui/Card";
import { ProgramDetailsEditor } from "./ProgramDetailsEditor";
import { ProgramStatusActions } from "./ProgramStatusActions";
import { AddPhaseForm } from "./AddPhaseForm";
import { PhaseHeader } from "./PhaseHeader";
import { AddSessionForm } from "./AddSessionForm";
import { DeleteSessionButton } from "./DeleteSessionButton";
import { AddSessionExerciseForm, SessionExerciseRow } from "./SessionExerciseForm";
import type { HydratedTrainerProgramPhase } from "@/domains/trainerprogram/types";
import type { Exercise } from "@/domains/exerciselibrary/types";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function TrainerProgramBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ programId: string }>;
  searchParams: Promise<{ importWarnings?: string }>;
}) {
  const { programId } = await params;
  const { importWarnings } = await searchParams;
  const program = await getProgramWithPhases(programId);
  if (!program) notFound();

  const [hydratedPhases, exercises] = await Promise.all([
    Promise.all(program.phases.map((phase) => getPhaseHydrated(phase.id))),
    getExercisesForTrainer(),
  ]);
  const exercisesById = new Map(exercises.map((ex) => [ex.id, ex]));

  let warnings: string[] = [];
  if (importWarnings) {
    try {
      warnings = JSON.parse(importWarnings);
    } catch {
      // Malformed query param -- ignore rather than error the page.
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/trainer/programs" className="text-sm text-neutral-500 hover:underline">
        ← Your workout programs
      </Link>

      {warnings.length > 0 ? (
        <div className="space-y-1 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <p className="font-medium">Review before publishing:</p>
          <ul className="list-inside list-disc">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-4">
        <ProgramDetailsEditor programId={program.id} name={program.name} description={program.description} />
        <ProgramStatusActions programId={program.id} status={program.status} />
      </div>

      {program.status === "draft" ? (
        <p className="text-xs text-neutral-500">
          Draft — not assignable to clients yet. Publish once it&apos;s ready.
        </p>
      ) : null}

      <div className="space-y-4">
        {hydratedPhases.map((phase, i) =>
          phase ? <PhaseCard key={phase.id} phase={phase} phaseNumber={i + 1} exercises={exercises} exercisesById={exercisesById} /> : null
        )}
        <AddPhaseForm programId={program.id} />
      </div>
    </div>
  );
}

function PhaseCard({
  phase,
  phaseNumber,
  exercises,
  exercisesById,
}: {
  phase: HydratedTrainerProgramPhase;
  phaseNumber: number;
  exercises: Exercise[];
  exercisesById: Map<string, Exercise>;
}) {
  const takenDays = phase.sessions.map((s) => s.dayOfWeek);
  return (
    <Card>
      <PhaseHeader phase={phase} phaseNumber={phaseNumber} />

      <div className="space-y-3">
        {phase.sessions
          .slice()
          .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
          .map((session) => (
            <div key={session.id} className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium">
                  {DAY_NAMES[session.dayOfWeek]}
                  {session.name ? ` — ${session.name}` : ""}
                </p>
                <DeleteSessionButton sessionId={session.id} />
              </div>
              {session.exercises.length === 0 ? (
                <p className="text-xs text-neutral-400">No exercises yet.</p>
              ) : (
                <ul className="space-y-2">
                  {session.exercises
                    .slice()
                    .sort((a, b) => a.exerciseOrder - b.exerciseOrder)
                    .map((item) => (
                      <SessionExerciseRow
                        key={item.id}
                        item={item}
                        exercises={exercises}
                        exerciseName={exercisesById.get(item.exerciseId)?.name ?? "—"}
                      />
                    ))}
                </ul>
              )}
              <div className="mt-2">
                <AddSessionExerciseForm sessionId={session.id} exercises={exercises} />
              </div>
            </div>
          ))}
        <AddSessionForm phaseId={phase.id} takenDays={takenDays} />
      </div>
    </Card>
  );
}
