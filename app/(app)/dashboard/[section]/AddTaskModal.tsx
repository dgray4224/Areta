"use client";

import { useState } from "react";
import type { CreateTimelineEventInput } from "@/domains/timeline/schema";

// Same placeholder preset list as areta-mobile's AddEventModal.tsx —
// picking one just fills the title field, not backed by anything
// separate from custom_timeline_events itself.
const COMMON_DAILY_TASKS = [
  "Work",
  "Study",
  "Read",
  "Meditate",
  "Commute",
  "Errands",
  "Chores",
  "Family time",
  "Relax",
  "Grocery shopping",
];

const DEFAULT_DURATION_MINUTES = 30;

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, minutes));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

/**
 * Web counterpart to areta-mobile's AddEventModal.tsx — same fields
 * (title with a common-tasks preset list, optional notes, optional
 * specific time), same underlying create call
 * (domains/timeline/service.ts#createTimelineEvent). Modal chrome follows
 * this app's own established convention (ExercisePicker.tsx's
 * fixed-backdrop-plus-sheet pattern) rather than porting mobile's
 * react-native Modal, and uses plain <input type="time"> instead of
 * mobile's native spinner picker.
 */
export function AddTaskModal({
  open,
  date,
  onClose,
  onCreate,
}: {
  open: boolean;
  date: string;
  onClose: () => void;
  onCreate: (input: CreateTimelineEventInput) => void;
}) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [timeEnabled, setTimeEnabled] = useState(false);
  const [startTime, setStartTime] = useState("12:00");

  if (!open) return null;

  function reset() {
    setTitle("");
    setNotes("");
    setPresetsOpen(false);
    setTimeEnabled(false);
    setStartTime("12:00");
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const endTime = timeEnabled ? minutesToTime(timeToMinutes(startTime) + DEFAULT_DURATION_MINUTES) : undefined;
    onCreate({
      date,
      title: title.trim(),
      notes: notes.trim() || undefined,
      scheduledTime: timeEnabled ? `${startTime}:00` : undefined,
      endTime: endTime ? `${endTime}:00` : undefined,
    });
    reset();
    onClose();
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close"
        onClick={handleClose}
        className="fixed inset-0 z-40 bg-black/30"
      />
      <form
        onSubmit={handleSubmit}
        className="fixed inset-x-4 bottom-4 top-16 z-50 mx-auto flex max-w-md flex-col gap-4 overflow-y-auto rounded-2xl border border-black/5 bg-card p-5 shadow-xl dark:border-white/5 sm:inset-x-auto sm:left-1/2 sm:w-full sm:-translate-x-1/2"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add task</h2>
          <button type="button" onClick={handleClose} className="text-sm font-medium text-brand">
            Cancel
          </button>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-500">Title</label>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What's this task?"
            className="w-full rounded-md border border-neutral-300 bg-card px-3 py-2 text-sm dark:border-neutral-700"
          />
          <button
            type="button"
            onClick={() => setPresetsOpen((o) => !o)}
            className="mt-1.5 text-xs font-semibold text-brand"
          >
            {presetsOpen ? "Hide common tasks ▲" : "Choose from common tasks ▾"}
          </button>
          {presetsOpen ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {COMMON_DAILY_TASKS.map((task) => (
                <button
                  key={task}
                  type="button"
                  onClick={() => {
                    setTitle(task);
                    setPresetsOpen(false);
                  }}
                  className="rounded-full border border-neutral-300 px-2.5 py-1 text-xs text-neutral-600 hover:bg-black/[0.03] dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-white/5"
                >
                  {task}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-500">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add a note…"
            rows={2}
            className="w-full rounded-md border border-neutral-300 bg-card px-3 py-2 text-sm dark:border-neutral-700"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={timeEnabled} onChange={(e) => setTimeEnabled(e.target.checked)} />
            Set a specific time
          </label>
          {!timeEnabled ? (
            <p className="mt-1 text-xs text-neutral-500">Without a time, this goes to Unscheduled until you place it.</p>
          ) : (
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="mt-2 rounded-md border border-neutral-300 bg-card px-3 py-2 text-sm dark:border-neutral-700"
            />
          )}
        </div>

        <button
          type="submit"
          disabled={!title.trim()}
          className="mt-auto w-full rounded-md bg-brand-fill px-3 py-2 text-sm font-medium text-brand-ink disabled:opacity-50"
        >
          Add
        </button>
      </form>
    </>
  );
}
