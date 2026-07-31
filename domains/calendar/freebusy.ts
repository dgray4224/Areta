import type { OpenWindow } from "@/domains/calendar/schema";

export type BusyBlock = { start: string; end: string };
export type DayWindow = { date: string; wakeTime: string; bedTime: string };

/**
 * Deterministic free/busy math (CLAUDE.md rule 6 — no AI for calculations).
 * All timestamps are ISO strings compared as UTC wall-clock time, the same
 * UTC-based simplification `dashboard/data.ts`'s `todayDateString()` already
 * uses elsewhere in this app — real per-user timezone correctness is a
 * known, already-documented gap, not solved half-way just for this module.
 */

/** Sorts and coalesces overlapping or touching (start <= previous end)
 * blocks into the minimal set of busy intervals. */
export function mergeBusyBlocks(blocks: BusyBlock[]): BusyBlock[] {
  if (blocks.length === 0) return [];
  const sorted = [...blocks].sort((a, b) => a.start.localeCompare(b.start));
  const merged: BusyBlock[] = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const current = sorted[i];
    if (current.start <= last.end) {
      if (current.end > last.end) last.end = current.end;
    } else {
      merged.push({ ...current });
    }
  }
  return merged;
}

/** Subtracts busy blocks from a single day's available window, dropping
 * gaps shorter than minDurationMinutes. */
export function computeOpenWindows(
  busyBlocks: BusyBlock[],
  dayWindow: { start: string; end: string },
  minDurationMinutes: number
): BusyBlock[] {
  const clamped = busyBlocks
    .filter((b) => b.start < dayWindow.end && b.end > dayWindow.start)
    .map((b) => ({
      start: b.start < dayWindow.start ? dayWindow.start : b.start,
      end: b.end > dayWindow.end ? dayWindow.end : b.end,
    }));
  const merged = mergeBusyBlocks(clamped);

  const open: BusyBlock[] = [];
  let cursor = dayWindow.start;
  for (const block of merged) {
    if (block.start > cursor) {
      open.push({ start: cursor, end: block.start });
    }
    if (block.end > cursor) cursor = block.end;
  }
  if (cursor < dayWindow.end) {
    open.push({ start: cursor, end: dayWindow.end });
  }

  return open.filter((w) => minutesBetween(w.start, w.end) >= minDurationMinutes);
}

/** Fixed splits around the UTC hour — `identity.workHoursNote` is free
 * text, not structured data, so this stays intentionally coarse rather than
 * over-fitting a field that isn't real structured data (known v1 limitation). */
export function tagDayPart(isoTime: string): OpenWindow["dayPart"] {
  const hour = new Date(isoTime).getUTCHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

/**
 * Top-level orchestrator: given a flat list of busy events and a list of
 * days (each with that day's wake/bed time), returns a flat sorted list of
 * open windows across all of them. V1 does not bind a specific window to a
 * specific goal/task — that's a real scheduling problem, deferred past this
 * pass (see the plan).
 */
export function buildDailyAvailability(
  events: BusyBlock[],
  days: DayWindow[],
  minDurationMinutes = 30
): OpenWindow[] {
  const results: OpenWindow[] = [];

  for (const day of days) {
    const dayWindow = {
      start: `${day.date}T${day.wakeTime}:00.000Z`,
      end: `${day.date}T${day.bedTime}:00.000Z`,
    };
    const windows = computeOpenWindows(events, dayWindow, minDurationMinutes);
    for (const w of windows) {
      results.push({
        date: day.date,
        start: w.start,
        end: w.end,
        durationMinutes: Math.round(minutesBetween(w.start, w.end)),
        dayPart: tagDayPart(w.start),
      });
    }
  }

  return results.sort((a, b) => a.start.localeCompare(b.start));
}

function minutesBetween(startIso: string, endIso: string): number {
  return (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000;
}
