"use client";

import { useMemo, useState } from "react";
import type { Exercise } from "@/domains/exerciselibrary/types";

export type ExerciseScheme = { sets: number | null; reps: number | null; durationMinutes: number | null };

/** Cardio work is almost never tagged "cardio" first in
 * primaryMuscleGroups (the data lists the prime mover first instead,
 * e.g. ["legs", "cardio"]) — pulled into its own bucket whenever it's
 * tagged anywhere in the list, same fix the trainer-side picker already
 * applies (app/(trainer)/trainer/ExercisePicker.tsx), everything else
 * buckets by its first tag unchanged. */
function categoryFor(ex: Exercise): string {
  if (ex.primaryMuscleGroups.some((g) => g.toLowerCase() === "cardio")) return "cardio";
  return ex.primaryMuscleGroups[0] ?? "Other";
}

function isCardioPattern(movementPattern: string): boolean {
  return movementPattern.toLowerCase().includes("aerobic");
}

/**
 * Client-facing browse-by-muscle-group exercise picker — open access to
 * the whole library (not just a slot's curated alternates), matching
 * areta-mobile's ExercisePicker.tsx: pick a category or search, pick an
 * exercise, set sets/reps (or duration for cardio-pattern movements),
 * confirm. Deliberately does NOT include the trainer-side picker's
 * "add a new exercise to the library" capability
 * (app/(trainer)/trainer/ExercisePicker.tsx) — that writes new rows into
 * the shared exercises table under trainer review, not something a
 * regular client action should be able to do; a client can only pick
 * from what's already there, same boundary mobile's picker has.
 *
 * Internal state (selected exercise, category, sets/reps draft) only
 * resets via handleClose (Cancel/backdrop) — it does NOT watch `open`
 * itself, since a confirm-triggered close goes through the parent
 * flipping `open` to false directly. Callers that reopen this for a new
 * session right after a successful confirm (e.g. "Add exercise" right
 * after a swap) MUST remount it with a fresh `key` — found live-testing
 * without one, the previous session's selection/scheme leaked into the
 * next open instead of starting fresh.
 */
export function ExercisePicker({
  open,
  mode,
  exercises,
  currentScheme,
  onClose,
  onConfirm,
  confirming,
  confirmLabel,
}: {
  open: boolean;
  mode: "swap" | "add";
  exercises: Exercise[];
  currentScheme?: ExerciseScheme;
  onClose: () => void;
  onConfirm: (exerciseId: string, scheme: ExerciseScheme) => void;
  confirming: boolean;
  confirmLabel?: string;
}) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [sets, setSets] = useState("");
  const [reps, setReps] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ex of exercises) {
      const group = categoryFor(ex);
      counts.set(group, (counts.get(group) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [exercises]);

  const searching = query.trim().length > 0;
  const showingList = searching || activeCategory !== null;

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

  function reset() {
    setQuery("");
    setActiveCategory(null);
    setSelected(null);
    setSets("");
    setReps("");
    setDurationMinutes("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  function goBack() {
    if (selected) setSelected(null);
    else if (showingList) {
      setActiveCategory(null);
      setQuery("");
    } else handleClose();
  }

  function selectExercise(ex: Exercise) {
    setSelected(ex);
    if (isCardioPattern(ex.movementPattern)) {
      setDurationMinutes(currentScheme?.durationMinutes ? String(currentScheme.durationMinutes) : "30");
    } else {
      setSets(currentScheme?.sets ? String(currentScheme.sets) : "3");
      setReps(currentScheme?.reps ? String(currentScheme.reps) : "10");
    }
  }

  function handleConfirm() {
    if (!selected) return;
    const cardio = isCardioPattern(selected.movementPattern);
    onConfirm(selected.id, {
      sets: cardio ? null : parseInt(sets, 10) || null,
      reps: cardio ? null : parseInt(reps, 10) || null,
      durationMinutes: cardio ? parseInt(durationMinutes, 10) || null : null,
    });
  }

  if (!open) return null;

  const title = selected
    ? selected.name
    : showingList
      ? (activeCategory ?? "Search results")
      : mode === "add"
        ? "Add exercise"
        : "Change exercise";

  return (
    <>
      <button
        type="button"
        aria-label="Close"
        onClick={handleClose}
        className="fixed inset-0 z-40 bg-black/30"
      />
      <div className="fixed inset-x-4 bottom-4 top-16 z-50 mx-auto flex max-w-lg flex-col rounded-2xl border border-black/5 bg-card p-4 shadow-xl dark:border-white/5 sm:inset-x-auto sm:left-1/2 sm:w-full sm:-translate-x-1/2">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="truncate text-base font-semibold">{title}</h2>
          <button type="button" onClick={goBack} className="shrink-0 text-sm font-medium text-brand">
            {selected || showingList ? "‹ Back" : "Cancel"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!selected && !showingList ? (
            <>
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search all exercises…"
                className="mb-3 w-full rounded-md border border-neutral-300 bg-card px-3 py-2 text-sm dark:border-neutral-700"
              />
              <div className="space-y-1.5">
                {categories.map(([category, count]) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className="flex w-full items-center justify-between rounded-lg border border-neutral-200 px-3 py-2.5 text-left text-sm capitalize hover:bg-black/[0.03] dark:border-neutral-800 dark:hover:bg-white/5"
                  >
                    <span className="font-medium">{category}</span>
                    <span className="text-xs text-neutral-500">{count} ›</span>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {!selected && showingList ? (
            <div className="space-y-1.5">
              {visibleExercises.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => selectExercise(ex)}
                  className="block w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-left hover:bg-black/[0.03] dark:border-neutral-800 dark:hover:bg-white/5"
                >
                  <p className="text-sm font-medium">{ex.name}</p>
                  <p className="text-xs text-neutral-500">
                    {searching ? `${categoryFor(ex)} · ` : ""}
                    {ex.equipmentRequired.join(", ") || "Bodyweight"}
                  </p>
                </button>
              ))}
              {visibleExercises.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  {searching ? `No exercises match "${query}".` : "No exercises in this category."}
                </p>
              ) : null}
            </div>
          ) : null}

          {selected ? (
            <div className="space-y-4">
              {isCardioPattern(selected.movementPattern) ? (
                <div>
                  <label className="mb-1 block text-xs text-neutral-500">Duration (minutes)</label>
                  <input
                    type="number"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    className="w-full rounded-md border border-neutral-300 bg-card px-3 py-2 text-sm dark:border-neutral-700"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-neutral-500">Sets</label>
                    <input
                      type="number"
                      value={sets}
                      onChange={(e) => setSets(e.target.value)}
                      className="w-full rounded-md border border-neutral-300 bg-card px-3 py-2 text-sm dark:border-neutral-700"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-neutral-500">Reps</label>
                    <input
                      type="number"
                      value={reps}
                      onChange={(e) => setReps(e.target.value)}
                      className="w-full rounded-md border border-neutral-300 bg-card px-3 py-2 text-sm dark:border-neutral-700"
                    />
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={handleConfirm}
                disabled={confirming}
                className="w-full rounded-md bg-brand-fill px-3 py-2 text-sm font-medium text-brand-ink disabled:opacity-50"
              >
                {confirming ? "Saving…" : (confirmLabel ?? (mode === "add" ? "Add to today's workout" : "Use this exercise"))}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
