"use client";

import { useId, useState, useTransition } from "react";
import { createExerciseAsTrainer } from "@/domains/trainerprogram/service";
import { TextInput, SelectInput, TextArea } from "@/platform/ui/FormField";
import { Button } from "@/platform/ui/Button";
import type { Exercise } from "@/domains/exerciselibrary/types";

/** Shared prescription field set for both the program builder
 * (SessionExerciseForm.tsx) and the calendar day editor
 * (DayEditorPanel.tsx) -- was duplicated between the two until
 * 2026-08-06, when both also needed the same two fixes: a searchable
 * exercise picker (140+ plain <option>s wasn't usable) and the
 * "add a new exercise" capability the calendar editor was missing
 * entirely. One `reps` field, not separate min/max -- "less is more";
 * still written into both repsMin/repsMax on save so nothing about the
 * richer prescription data model actually changes, just the form. */
export type PrescriptionFields = {
  exerciseId: string;
  sets: string;
  reps: string;
  intensityType: string;
  intensityValue: string;
  durationMinutes: string;
  cardioIntensity: string;
  coachingNotes: string;
};

export const EMPTY_PRESCRIPTION_FIELDS: PrescriptionFields = {
  exerciseId: "",
  sets: "",
  reps: "",
  intensityType: "",
  intensityValue: "",
  durationMinutes: "",
  cardioIntensity: "",
  coachingNotes: "",
};

/** Loads a single-reps-field form from data that still carries the
 * richer repsMin/repsMax shape -- repsMax preferred, since that's what
 * a single-number prescription naturally lands on (repsMin === repsMax
 * once this form is the only thing writing these rows going forward). */
export function prescriptionFieldsFrom(ex: {
  exerciseId: string;
  sets: number | null;
  repsMin: number | null;
  repsMax: number | null;
  intensityType: string | null;
  intensityValue: string | null;
  durationMinutes: number | null;
  cardioIntensity: string | null;
  coachingNotes: string | null;
}): PrescriptionFields {
  return {
    exerciseId: ex.exerciseId,
    sets: ex.sets?.toString() ?? "",
    reps: (ex.repsMax ?? ex.repsMin)?.toString() ?? "",
    intensityType: ex.intensityType ?? "",
    intensityValue: ex.intensityValue ?? "",
    durationMinutes: ex.durationMinutes?.toString() ?? "",
    cardioIntensity: ex.cardioIntensity ?? "",
    coachingNotes: ex.coachingNotes ?? "",
  };
}

export function ExercisePicker({
  fields,
  setFields,
  exercises,
  onExerciseCreated,
}: {
  fields: PrescriptionFields;
  setFields: (f: PrescriptionFields) => void;
  exercises: Exercise[];
  onExerciseCreated: (ex: Exercise) => void;
}) {
  const datalistId = useId();
  const [addingExercise, setAddingExercise] = useState(false);
  const [query, setQuery] = useState(() => exercises.find((ex) => ex.id === fields.exerciseId)?.name ?? "");

  const onQueryChange = (value: string) => {
    setQuery(value);
    const match = exercises.find((ex) => ex.name.toLowerCase() === value.trim().toLowerCase());
    setFields({ ...fields, exerciseId: match?.id ?? "" });
  };

  return (
    <div className="space-y-2">
      <TextInput
        type="text"
        list={datalistId}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search exercises…"
        aria-label="Exercise"
      />
      <datalist id={datalistId}>
        {exercises.map((ex) => (
          <option key={ex.id} value={ex.name} />
        ))}
      </datalist>
      {fields.exerciseId === "" && query !== "" ? (
        <p className="text-xs text-neutral-500">No exact match yet — keep typing or pick from the list.</p>
      ) : null}
      {addingExercise ? (
        <NewExerciseInline
          onCancel={() => setAddingExercise(false)}
          onCreated={(ex) => {
            onExerciseCreated(ex);
            setFields({ ...fields, exerciseId: ex.id });
            setQuery(ex.name);
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

      <div className="grid grid-cols-3 gap-2">
        <TextInput
          type="number"
          placeholder="Sets"
          value={fields.sets}
          onChange={(e) => setFields({ ...fields, sets: e.target.value })}
        />
        <TextInput
          type="number"
          placeholder="Reps"
          value={fields.reps}
          onChange={(e) => setFields({ ...fields, reps: e.target.value })}
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
 * waiting on that review. Previously only wired into the program
 * builder; the calendar day editor had no path to this at all until
 * this file unified both pickers. */
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
