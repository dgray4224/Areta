"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addSessionExercise,
  updateSessionExercise,
  deleteSessionExercise,
  createExerciseAsTrainer,
} from "@/domains/trainerprogram/service";
import { SelectInput, TextInput, TextArea } from "@/platform/ui/FormField";
import { Button } from "@/platform/ui/Button";
import type { Exercise } from "@/domains/exerciselibrary/types";
import type { TrainerProgramSessionExercise } from "@/domains/trainerprogram/types";

type Fields = {
  exerciseId: string;
  sets: string;
  repsMin: string;
  repsMax: string;
  intensityType: string;
  intensityValue: string;
  durationMinutes: string;
  cardioIntensity: string;
  coachingNotes: string;
};

const EMPTY_FIELDS: Fields = {
  exerciseId: "",
  sets: "",
  repsMin: "",
  repsMax: "",
  intensityType: "",
  intensityValue: "",
  durationMinutes: "",
  cardioIntensity: "",
  coachingNotes: "",
};

function toFields(ex: TrainerProgramSessionExercise): Fields {
  return {
    exerciseId: ex.exerciseId,
    sets: ex.sets?.toString() ?? "",
    repsMin: ex.repsMin?.toString() ?? "",
    repsMax: ex.repsMax?.toString() ?? "",
    intensityType: ex.intensityType ?? "",
    intensityValue: ex.intensityValue ?? "",
    durationMinutes: ex.durationMinutes?.toString() ?? "",
    cardioIntensity: ex.cardioIntensity ?? "",
    coachingNotes: ex.coachingNotes ?? "",
  };
}

function toInput(f: Fields) {
  return {
    exerciseId: f.exerciseId,
    sets: f.sets ? Number(f.sets) : undefined,
    repsMin: f.repsMin ? Number(f.repsMin) : undefined,
    repsMax: f.repsMax ? Number(f.repsMax) : undefined,
    intensityType: f.intensityType ? (f.intensityType as "percent_1rm" | "rpe" | "none") : undefined,
    intensityValue: f.intensityValue || undefined,
    durationMinutes: f.durationMinutes ? Number(f.durationMinutes) : undefined,
    cardioIntensity: f.cardioIntensity || undefined,
    coachingNotes: f.coachingNotes || undefined,
  };
}

/** Shared field markup for both the add-new and edit-in-place forms below
 * — same 9-field set (mirrors trainer_program_session_exercises exactly,
 * the richer prescription detail the existing client-plan "Customize"
 * form doesn't capture) rendered twice would otherwise drift out of sync. */
function ExerciseFields({
  fields,
  setFields,
  exercises,
  onExerciseCreated,
}: {
  fields: Fields;
  setFields: (f: Fields) => void;
  exercises: Exercise[];
  onExerciseCreated: (ex: Exercise) => void;
}) {
  const [addingExercise, setAddingExercise] = useState(false);

  return (
    <div className="space-y-2">
      <SelectInput
        value={fields.exerciseId}
        onChange={(e) => setFields({ ...fields, exerciseId: e.target.value })}
        aria-label="Exercise"
      >
        <option value="">Pick an exercise…</option>
        {exercises.map((ex) => (
          <option key={ex.id} value={ex.id}>
            {ex.name}
          </option>
        ))}
      </SelectInput>
      {addingExercise ? (
        <NewExerciseInline
          onCancel={() => setAddingExercise(false)}
          onCreated={(ex) => {
            onExerciseCreated(ex);
            setFields({ ...fields, exerciseId: ex.id });
            setAddingExercise(false);
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAddingExercise(true)}
          className="text-xs text-neutral-500 hover:underline"
        >
          Can&apos;t find it? Add a new exercise
        </button>
      )}

      <div className="grid grid-cols-4 gap-2">
        <TextInput
          type="number"
          placeholder="Sets"
          value={fields.sets}
          onChange={(e) => setFields({ ...fields, sets: e.target.value })}
        />
        <TextInput
          type="number"
          placeholder="Reps min"
          value={fields.repsMin}
          onChange={(e) => setFields({ ...fields, repsMin: e.target.value })}
        />
        <TextInput
          type="number"
          placeholder="Reps max"
          value={fields.repsMax}
          onChange={(e) => setFields({ ...fields, repsMax: e.target.value })}
        />
        <TextInput
          type="number"
          placeholder="Minutes"
          value={fields.durationMinutes}
          onChange={(e) => setFields({ ...fields, durationMinutes: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <SelectInput
          value={fields.intensityType}
          onChange={(e) => setFields({ ...fields, intensityType: e.target.value })}
          aria-label="Intensity type"
        >
          <option value="">No intensity target</option>
          <option value="rpe">RPE</option>
          <option value="percent_1rm">% of 1RM</option>
        </SelectInput>
        <TextInput
          placeholder="Intensity value"
          value={fields.intensityValue}
          onChange={(e) => setFields({ ...fields, intensityValue: e.target.value })}
        />
        <TextInput
          placeholder="Cardio intensity"
          value={fields.cardioIntensity}
          onChange={(e) => setFields({ ...fields, cardioIntensity: e.target.value })}
        />
      </div>
      <TextArea
        placeholder="Coaching notes (optional) — cues, tempo, anything the client should see"
        rows={2}
        value={fields.coachingNotes}
        onChange={(e) => setFields({ ...fields, coachingNotes: e.target.value })}
      />
    </div>
  );
}

/** Inline "add a new exercise" mini-form — inserts into the shared
 * exercises table with status 'review' (admin-reviewable, migration
 * 0075), immediately usable by this trainer's own clients without
 * waiting on that review. */
function NewExerciseInline({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (ex: Exercise) => void;
}) {
  const [name, setName] = useState("");
  const [movementPattern, setMovementPattern] = useState("");
  const [difficulty, setDifficulty] = useState<"beginner" | "intermediate" | "advanced">("beginner");
  const [equipment, setEquipment] = useState("");
  const [muscleGroups, setMuscleGroups] = useState("");
  const [instructions, setInstructions] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const csv = (v: string) =>
    v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const onSave = () => {
    if (!name || !movementPattern) {
      setError("Name and movement pattern are required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createExerciseAsTrainer({
        name,
        movementPattern,
        difficulty,
        equipmentRequired: csv(equipment),
        primaryMuscleGroups: csv(muscleGroups),
        archetypeTags: [],
        instructions: instructions || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onCreated({
        id: result.data.id,
        name,
        movementPattern,
        equipmentRequired: csv(equipment),
        archetypeTags: [],
        difficulty,
        primaryMuscleGroups: csv(muscleGroups),
        instructions: instructions || null,
      });
    });
  };

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-neutral-300 p-2 dark:border-neutral-700">
      <div className="grid grid-cols-2 gap-2">
        <TextInput placeholder="Exercise name" value={name} onChange={(e) => setName(e.target.value)} />
        <TextInput
          placeholder="Movement pattern"
          value={movementPattern}
          onChange={(e) => setMovementPattern(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <SelectInput value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </SelectInput>
        <TextInput
          placeholder="Equipment (comma-separated)"
          value={equipment}
          onChange={(e) => setEquipment(e.target.value)}
        />
        <TextInput
          placeholder="Muscle groups (comma-separated)"
          value={muscleGroups}
          onChange={(e) => setMuscleGroups(e.target.value)}
        />
      </div>
      <TextArea
        placeholder="Instructions (optional)"
        rows={2}
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="button" variant="secondary" disabled={isPending} onClick={onSave}>
          {isPending ? "Saving…" : "Add exercise"}
        </Button>
        <button type="button" onClick={onCancel} className="text-xs text-neutral-500 hover:underline">
          Cancel
        </button>
      </div>
    </div>
  );
}

export function AddSessionExerciseForm({ sessionId, exercises }: { sessionId: string; exercises: Exercise[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<Fields>(EMPTY_FIELDS);
  const [exerciseList, setExerciseList] = useState(exercises);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-neutral-500 hover:underline">
        + Add exercise
      </button>
    );
  }

  const onSave = () => {
    if (!fields.exerciseId) {
      setError("Pick an exercise.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await addSessionExercise(sessionId, toInput(fields));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setFields(EMPTY_FIELDS);
      router.refresh();
    });
  };

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
      <ExerciseFields
        fields={fields}
        setFields={setFields}
        exercises={exerciseList}
        onExerciseCreated={(ex) => setExerciseList((prev) => [...prev, ex])}
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="button" variant="secondary" disabled={isPending} onClick={onSave}>
          {isPending ? "Saving…" : "Add"}
        </Button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-neutral-500 hover:underline">
          Cancel
        </button>
      </div>
    </div>
  );
}

export function SessionExerciseRow({
  item,
  exercises,
  exerciseName,
}: {
  item: TrainerProgramSessionExercise;
  exercises: Exercise[];
  exerciseName: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState<Fields>(() => toFields(item));
  const [exerciseList, setExerciseList] = useState(exercises);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSave = () => {
    if (!fields.exerciseId) {
      setError("Pick an exercise.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updateSessionExercise(item.id, toInput(fields));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  };

  const onDelete = () => {
    if (!confirm("Remove this exercise from the session?")) return;
    startTransition(async () => {
      const result = await deleteSessionExercise(item.id);
      if (!result.ok) {
        alert(result.error);
        return;
      }
      router.refresh();
    });
  };

  if (!editing) {
    const repsLabel =
      item.repsMin !== null && item.repsMax !== null
        ? item.repsMin === item.repsMax
          ? `${item.repsMin}`
          : `${item.repsMin}-${item.repsMax}`
        : "?";
    const intensity =
      item.intensityType === "rpe" && item.intensityValue
        ? ` @ RPE ${item.intensityValue}`
        : item.intensityType === "percent_1rm" && item.intensityValue
          ? ` @ ${item.intensityValue}%`
          : "";
    return (
      <li className="text-sm text-neutral-600 dark:text-neutral-400">
        <div className="flex items-center justify-between">
          <span>
            {exerciseName}
            {item.durationMinutes !== null && item.repsMin === null
              ? ` — ${item.durationMinutes} min${item.cardioIntensity ? ` (${item.cardioIntensity})` : ""}`
              : ` — ${item.sets ?? "?"} × ${repsLabel}${intensity}`}
          </span>
          <span className="flex gap-2 text-xs">
            <button type="button" onClick={() => setEditing(true)} className="hover:underline">
              Edit
            </button>
            <button type="button" onClick={onDelete} disabled={isPending} className="text-red-600 hover:underline">
              Remove
            </button>
          </span>
        </div>
        {item.coachingNotes ? <p className="mt-0.5 text-xs italic text-neutral-500">{item.coachingNotes}</p> : null}
      </li>
    );
  }

  return (
    <li className="space-y-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
      <ExerciseFields
        fields={fields}
        setFields={setFields}
        exercises={exerciseList}
        onExerciseCreated={(ex) => setExerciseList((prev) => [...prev, ex])}
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="button" variant="secondary" disabled={isPending} onClick={onSave}>
          {isPending ? "Saving…" : "Save"}
        </Button>
        <button type="button" onClick={() => setEditing(false)} className="text-xs text-neutral-500 hover:underline">
          Cancel
        </button>
      </div>
    </li>
  );
}
