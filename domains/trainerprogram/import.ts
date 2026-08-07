"use server";

import { createClient } from "@/platform/supabase/server";
import { requireTrainer } from "@/platform/auth/trainer";
import { getAIProvider } from "@/platform/ai/get-provider";
import { trainerProgramImportSchema, type TrainerProgramImport } from "@/domains/trainerprogram/import-schema";
import {
  createProgram,
  addPhase,
  addSession,
  addSessionExercise,
  createExerciseAsTrainer,
  getExercisesForTrainer,
} from "@/domains/trainerprogram/service";
import type { ActionResult } from "@/platform/auth/actions";
import type { Exercise } from "@/domains/exerciselibrary/types";

const IMPORT_INSTRUCTIONS = `A personal trainer has pasted a training program they already wrote (spreadsheet copy-paste, plain text, a document dump — any format). Extract it into structured phases, sessions, and exercises.

Rules:
- A "phase" is a block of consecutive identical weeks (e.g. "Weeks 1-4: Hypertrophy"). If the program has no obvious blocks, use one phase covering the whole thing.
- A "session" is one training day within a phase, with an explicit day of the week (0=Sunday..6=Saturday). If the source only says "Day 1/Day 2/Day 3" with no explicit weekday, distribute them evenly across the week (e.g. 3 sessions -> Monday/Wednesday/Friday) rather than guessing arbitrarily.
- Preserve every exercise, its sets/reps/intensity/notes exactly as written -- do not invent prescriptions that weren't stated. Leave a field null rather than guessing a number.
- exerciseName should be the exercise as named in the source text, not normalized to a canonical name.
- Only mark isFinal true on the last phase.`;

/**
 * Turns a trainer's pasted program into real trainer_programs/phases/
 * sessions/session_exercises rows in one shot, immediately after the AI
 * extraction -- there's no separate "confirm this JSON" screen because
 * the program lands in 'draft' status (assignProgramToClient refuses
 * anything but 'published'), and the trainer is redirected straight into
 * the same builder used for hand-authored programs, which already
 * supports editing/reordering/deleting everything at every level. That
 * builder *is* the review step, per CLAUDE.md rule 8 ("validate all AI
 * output") -- nothing generated here can reach a client until the
 * trainer both reviews it there and explicitly publishes + assigns it.
 *
 * Exercise names are matched against this trainer's available exercises
 * deterministically (CLAUDE.md rule 6) -- exact, then substring, both
 * case-insensitive -- and anything unmatched is auto-created as a new
 * 'review'-status exercise from the AI's best-guess metadata (same path
 * as createExerciseAsTrainer), so every prescription always resolves to
 * a real exercise the trainer can immediately see and fix in the
 * builder, rather than silently dropping unmatched lines.
 */
export async function importProgramFromText(
  pastedText: string
): Promise<ActionResult<{ programId: string; warnings: string[] }>> {
  const { user } = await requireTrainer();
  if (!pastedText.trim()) return { ok: false, error: "Paste a program first." };

  const supabase = await createClient();
  const provider = getAIProvider();
  const result = await provider.generateStructured({
    instructions: IMPORT_INSTRUCTIONS,
    context: { pastedText },
    schema: trainerProgramImportSchema,
  });

  await supabase.from("ai_runs").insert({
    user_id: user.id,
    purpose: "trainer_program_import",
    model: "claude-sonnet-5",
    success: result.ok,
    error: result.ok ? null : result.error,
  });

  if (!result.ok) return { ok: false, error: result.error };

  return saveImportedProgram(result.data);
}

/** Split out from importProgramFromText so the parse-then-save boundary
 * is testable independently of a live AI call. */
export async function saveImportedProgram(
  draft: TrainerProgramImport
): Promise<ActionResult<{ programId: string; warnings: string[] }>> {
  const warnings: string[] = [];

  const created = await createProgram({ name: draft.programName, description: "Imported from pasted text." });
  if (!created.ok) return created;
  const programId = created.data.id;

  const available = await getExercisesForTrainer();
  const exerciseCache = new Map<string, Exercise>(available.map((ex) => [ex.id, ex]));

  for (const phase of draft.phases) {
    const phaseResult = await addPhase(programId, {
      name: phase.name,
      focus: phase.focus ?? undefined,
      lengthWeeks: phase.lengthWeeks,
      isFinal: phase.isFinal,
    });
    if (!phaseResult.ok) {
      warnings.push(`Skipped phase "${phase.name}": ${phaseResult.error}`);
      continue;
    }

    for (const session of phase.sessions) {
      const sessionResult = await addSession(phaseResult.data.id, {
        dayOfWeek: session.dayOfWeek,
        name: session.name ?? undefined,
        sessionType: session.sessionType ?? undefined,
      });
      if (!sessionResult.ok) {
        warnings.push(`Skipped a session in "${phase.name}": ${sessionResult.error}`);
        continue;
      }

      for (const ex of session.exercises) {
        const exerciseId = await resolveExerciseId(ex, exerciseCache, warnings);
        if (!exerciseId) continue;

        const itemResult = await addSessionExercise(sessionResult.data.id, {
          exerciseId,
          sets: ex.sets ?? undefined,
          repsMin: ex.repsMin ?? undefined,
          repsMax: ex.repsMax ?? undefined,
          intensityType: ex.intensityType ?? undefined,
          intensityValue: ex.intensityValue ?? undefined,
          durationMinutes: ex.durationMinutes ?? undefined,
          cardioIntensity: ex.cardioIntensity ?? undefined,
          coachingNotes: ex.coachingNotes ?? undefined,
        });
        if (!itemResult.ok) {
          warnings.push(`Couldn't add "${ex.exerciseName}": ${itemResult.error}`);
        }
      }
    }
  }

  return { ok: true, data: { programId, warnings } };
}

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

async function resolveExerciseId(
  ex: TrainerProgramImport["phases"][number]["sessions"][number]["exercises"][number],
  cache: Map<string, Exercise>,
  warnings: string[]
): Promise<string | null> {
  const target = normalize(ex.exerciseName);
  for (const [id, exercise] of cache) {
    if (normalize(exercise.name) === target) return id;
  }
  for (const [id, exercise] of cache) {
    const n = normalize(exercise.name);
    if (n.includes(target) || target.includes(n)) return id;
  }

  const createResult = await createExerciseAsTrainer({
    name: ex.exerciseName,
    movementPattern: ex.movementPattern,
    difficulty: ex.difficulty,
    equipmentRequired: ex.equipmentRequired,
    primaryMuscleGroups: ex.primaryMuscleGroups,
    archetypeTags: [],
  });
  if (!createResult.ok) {
    warnings.push(`Couldn't create a new exercise for "${ex.exerciseName}": ${createResult.error}`);
    return null;
  }

  cache.set(createResult.data.id, {
    id: createResult.data.id,
    name: ex.exerciseName,
    movementPattern: ex.movementPattern,
    equipmentRequired: ex.equipmentRequired,
    archetypeTags: [],
    difficulty: ex.difficulty,
    primaryMuscleGroups: ex.primaryMuscleGroups,
    instructions: null,
  });
  warnings.push(`"${ex.exerciseName}" wasn't in your library — added it as a new exercise pending review.`);
  return createResult.data.id;
}
