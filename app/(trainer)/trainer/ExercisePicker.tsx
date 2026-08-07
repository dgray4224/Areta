"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createExerciseAsTrainer } from "@/domains/trainerprogram/service";
import { FormField, TextInput, SelectInput, TextArea } from "@/platform/ui/FormField";
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

/**
 * Which category a browse-by-muscle-group row lands in. Cardio work
 * (runs, bike, rowing, swim intervals, etc.) is almost never tagged with
 * "cardio" as primaryMuscleGroups[0] -- the data consistently lists the
 * prime mover first instead (e.g. ["legs", "cardio"], ["full body",
 * "cardio"], ["shoulders", "core", "cardio"]), since that's genuinely
 * the more useful *first* tag for other purposes. Taking index 0
 * verbatim (the original rule) scattered every cardio exercise across
 * "legs"/"full body"/"shoulders" instead of grouping them, which is
 * exactly backwards for browsing -- a trainer looking for cardio doesn't
 * think "which muscle does this train," so cardio gets pulled out to its
 * own bucket whenever it's tagged anywhere in the list, not just first.
 * (2026-08-07, user feedback.) Everything else still buckets by its
 * first tag, unchanged. */
function categoryFor(ex: Exercise): string {
  if (ex.primaryMuscleGroups.some((g) => g.toLowerCase() === "cardio")) return "cardio";
  return ex.primaryMuscleGroups[0] ?? "Other";
}

/**
 * Browse-by-muscle-group dropdown, mirroring the mobile Exercise tab's
 * ExercisePicker (lib/today-screens/ExercisePicker.tsx): pick a muscle-
 * group category first (avoids one long scroll through 140+ exercises,
 * the exact complaint that motivated this -- 2026-08-07) or type to
 * search across all of them at once, same as before. A native
 * `<datalist>` (the previous approach) can't be categorized or show
 * secondary text per row, so this is a small hand-built combobox
 * instead -- still zero new dependency, same as the datalist swap that
 * preceded it.
 *
 * Split out from ExercisePicker below (2026-08-07) so the two other
 * trainer-facing exercise pickers -- WorkoutItemCustomizer.tsx and
 * AddWorkoutItem.tsx, which write through customizeClientWorkoutItem/
 * addClientWorkoutItem and only ever accept exerciseId/sets/reps/
 * durationMinutes, no intensity/cardio/coaching-notes fields -- could
 * get the same categorized-browse-and-add-new experience without also
 * inheriting ExercisePicker's full prescription-fields grid, which
 * would silently collect intensity/cardio/notes input those two
 * actions have nowhere to save it.
 */
export function ExerciseSearchField({
  exerciseId,
  onSelect,
  exercises,
  onExerciseCreated,
}: {
  exerciseId: string;
  onSelect: (exerciseId: string) => void;
  exercises: Exercise[];
  onExerciseCreated: (ex: Exercise) => void;
}) {
  const [addingExercise, setAddingExercise] = useState(false);
  const [query, setQuery] = useState(() => exercises.find((ex) => ex.id === exerciseId)?.name ?? "");
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      // Deliberately e.composedPath() rather than
      // containerRef.current.contains(e.target) -- selecting a category
      // or exercise calls setState in the SAME mousedown handler, and
      // React can flush that synchronously before this bubble-phase
      // listener runs on `document`, unmounting the clicked button in
      // the process. e.target then points at an already-detached node,
      // so a plain .contains() check reads it as "outside" and closes
      // the dropdown on the very click meant to drill into it (found
      // 2026-08-07 testing live: the button's own onMouseDown had
      // already fired and set defaultPrevented=true, but the node was
      // gone from the document by the time this ran). composedPath() is
      // captured at dispatch time, before any such mutation, so it
      // still lists containerRef.current even if the target itself no
      // longer exists.
      if (containerRef.current && !e.composedPath().includes(containerRef.current)) {
        setOpen(false);
        setActiveCategory(null);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ex of exercises) {
      const group = categoryFor(ex);
      counts.set(group, (counts.get(group) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [exercises]);

  const searching = query.trim().length > 0;

  const visibleExercises = useMemo(() => {
    if (searching) {
      const needle = query.trim().toLowerCase();
      return exercises.filter((ex) => ex.name.toLowerCase().includes(needle));
    }
    if (activeCategory) {
      return exercises.filter((ex) => categoryFor(ex) === activeCategory);
    }
    return [];
  }, [exercises, query, searching, activeCategory]);

  const selectExercise = (ex: Exercise) => {
    onSelect(ex.id);
    setQuery(ex.name);
    setOpen(false);
    setActiveCategory(null);
  };

  const onQueryChange = (value: string) => {
    setQuery(value);
    setOpen(true);
    setActiveCategory(null);
    // Same exact-match rule as before the categorized dropdown existed
    // (kept for anyone who types/pastes a full name rather than
    // clicking): a non-exact partial match clears any prior selection
    // rather than leaving a stale exerciseId pointed at whatever used to
    // be typed.
    const match = exercises.find((ex) => ex.name.toLowerCase() === value.trim().toLowerCase());
    onSelect(match?.id ?? "");
  };

  return (
    <div className="space-y-2">
      <div className="relative" ref={containerRef}>
        <TextInput
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          placeholder="Search, or browse by muscle group…"
          aria-label="Exercise"
          autoComplete="off"
        />
        {open ? (
          <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-neutral-300 bg-card shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
            {searching ? (
              visibleExercises.length > 0 ? (
                visibleExercises.map((ex) => (
                  <button
                    key={ex.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectExercise(ex);
                    }}
                    className="flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    <span className="truncate font-medium">{ex.name}</span>
                    <span className="shrink-0 text-xs text-neutral-500">{categoryFor(ex)}</span>
                  </button>
                ))
              ) : (
                <p className="px-3 py-2 text-sm text-neutral-500">No exercises match &quot;{query}&quot;.</p>
              )
            ) : activeCategory ? (
              <>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setActiveCategory(null);
                  }}
                  className="block w-full border-b border-neutral-200 px-3 py-2 text-left text-xs text-neutral-500 hover:bg-neutral-100 dark:border-neutral-800 dark:hover:bg-neutral-800"
                >
                  ‹ Back to muscle groups
                </button>
                {visibleExercises.map((ex) => (
                  <button
                    key={ex.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectExercise(ex);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    {ex.name}
                  </button>
                ))}
              </>
            ) : (
              categories.map(([category, count]) => (
                <button
                  key={category}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setActiveCategory(category);
                  }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <span>{category}</span>
                  <span className="text-xs text-neutral-500">{count}</span>
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>
      {exerciseId === "" && query !== "" ? (
        <p className="text-xs text-neutral-500">No exact match yet — pick one from the list above.</p>
      ) : null}
      {addingExercise ? (
        <NewExerciseInline
          onCancel={() => setAddingExercise(false)}
          onCreated={(ex) => {
            onExerciseCreated(ex);
            onSelect(ex.id);
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
    </div>
  );
}

/** Wraps ExerciseSearchField above with the full prescription-fields grid
 * (sets/reps/minutes, intensity, cardio, coaching notes) -- what the
 * program builder (SessionExerciseForm.tsx) and calendar day editor
 * (DayEditorPanel.tsx) both need, since trainer_program_session_exercises
 * and trainer_program_date_overrides carry that richer shape. */
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
  return (
    <div className="space-y-2">
      <ExerciseSearchField
        exerciseId={fields.exerciseId}
        onSelect={(exerciseId) => setFields({ ...fields, exerciseId })}
        exercises={exercises}
        onExerciseCreated={onExerciseCreated}
      />
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
    <div className="space-y-3 rounded-lg border border-dashed border-neutral-300 p-3 dark:border-neutral-700">
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Exercise name" htmlFor="new-ex-name" hint="e.g. Bulgarian split squat">
          <TextInput id="new-ex-name" value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <FormField
          label="Movement pattern"
          htmlFor="new-ex-pattern"
          hint="What kind of move it is, not the muscle — e.g. squat, push, pull, carry, cardio"
        >
          <TextInput id="new-ex-pattern" value={movementPattern} onChange={(e) => setMovementPattern(e.target.value)} />
        </FormField>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <FormField label="Difficulty" htmlFor="new-ex-difficulty">
          <SelectInput
            id="new-ex-difficulty"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </SelectInput>
        </FormField>
        <FormField
          label="Equipment"
          htmlFor="new-ex-equipment"
          hint="Comma-separated — e.g. Barbell, Dumbbells, Bodyweight only, Cardio machine"
        >
          <TextInput id="new-ex-equipment" value={equipment} onChange={(e) => setEquipment(e.target.value)} />
        </FormField>
        <FormField
          label="Muscle groups"
          htmlFor="new-ex-muscles"
          hint="Comma-separated, most important one first — e.g. glutes, hamstrings"
        >
          <TextInput id="new-ex-muscles" value={muscleGroups} onChange={(e) => setMuscleGroups(e.target.value)} />
        </FormField>
      </div>
      <FormField
        label="Instructions"
        htmlFor="new-ex-instructions"
        hint='Optional — cues the client should see, e.g. "Keep chest up, drive through the heel."'
      >
        <TextArea
          id="new-ex-instructions"
          rows={2}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
      </FormField>
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
