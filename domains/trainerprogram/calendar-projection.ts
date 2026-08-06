import type { HydratedTrainerProgramPhase, OnProgramComplete } from "@/domains/trainerprogram/types";

export type ProjectedExercise = {
  exerciseId: string;
  sets: number | null;
  repsMin: number | null;
  repsMax: number | null;
  intensityType: "percent_1rm" | "rpe" | "none" | null;
  intensityValue: string | null;
  durationMinutes: number | null;
  cardioIntensity: string | null;
  coachingNotes: string | null;
  /** Non-null only for a template-sourced exercise -- lets materialize.ts
   * set workout_plan_items.trainer_program_session_exercise_id for
   * traceability, same as before. Null for an override (a date override
   * has no single upstream session_exercise row to point at). */
  sourceSessionExerciseId: string | null;
};

export type ProjectedDay = {
  date: string;
  dayOfWeek: number;
  /** "not_started": before the assignment's starts_on. "override": a
   * trainer_program_date_overrides row exists for this date (may itself
   * be a rest day). "template": the recurring day-of-week session for
   * whatever phase/week this date falls in. "rest": no override, and no
   * session is authored for this day-of-week in the resolved phase. */
  source: "not_started" | "override" | "template" | "rest";
  phaseId: string | null;
  phaseName: string | null;
  /** 1-indexed week within phaseId. */
  weekInPhase: number | null;
  sessionName: string | null;
  exercises: ProjectedExercise[];
};

export type DateOverrideInput = {
  isRestDay: boolean;
  exercises: ProjectedExercise[];
};

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toIsoDate(d);
}

/** The Sunday on or before the given date, in the same "day_of_week 0-6
 * = Sun-Sat, absolute weekday" convention workout_plan_items already
 * uses (see app/(app)/dashboard/data.ts's selectedDow computation) --
 * materialize.ts needs this to populate a full week's worth of items
 * (including any days earlier in the week than "today", when generation
 * happens to run mid-week) under the single workout_plans row the rest
 * of the app looks up by exact week_start match. */
export function sundayOfWeekContaining(isoDate: string): string {
  const dow = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  return addDays(isoDate, -dow);
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00Z`).getTime();
  const to = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

function dayOfWeekOf(isoDate: string): number {
  return new Date(`${isoDate}T00:00:00Z`).getUTCDay();
}

/**
 * Resolves which phase and which week-within-that-phase a given date
 * falls into, given the program started on `startsOn`. Phases are walked
 * in array order (callers must pass them already sorted by phaseOrder).
 * Pure arithmetic, no stored "pointer" to advance or drift out of sync --
 * the whole point of this rewrite (see migration 0076's doc comment):
 * the same computation always produces the same answer for the same
 * date, so the calendar and the real weekly generator can never disagree.
 */
function resolvePhaseForDate(
  date: string,
  startsOn: string,
  phases: HydratedTrainerProgramPhase[],
  onComplete: OnProgramComplete
): { phase: HydratedTrainerProgramPhase; weekInPhase: number } | null {
  if (phases.length === 0) return null;
  if (date < startsOn) return null;

  const weeksSinceStart = Math.floor(daysBetween(startsOn, date) / 7);
  const totalCycleWeeks = phases.reduce((sum, p) => sum + p.lengthWeeks, 0);
  if (totalCycleWeeks <= 0) return null;

  const effectiveWeekIndex =
    onComplete === "repeat" ? weeksSinceStart % totalCycleWeeks : Math.min(weeksSinceStart, totalCycleWeeks - 1);

  let remaining = effectiveWeekIndex;
  for (const phase of phases) {
    if (remaining < phase.lengthWeeks) {
      return { phase, weekInPhase: remaining + 1 };
    }
    remaining -= phase.lengthWeeks;
  }
  // Should be unreachable given effectiveWeekIndex < totalCycleWeeks, but
  // fall back to the last phase's last week rather than throwing.
  const last = phases[phases.length - 1];
  return { phase: last, weekInPhase: last.lengthWeeks };
}

/**
 * Projects a date range into a day-by-day schedule -- the single
 * function both the calendar UI and generateAndSaveFromTrainerProgram
 * call, so what a trainer sees on the calendar is never out of sync with
 * what actually lands in the client's real plan.
 */
export function projectProgramRange(input: {
  startsOn: string;
  /** Sorted by phaseOrder ascending. */
  phases: HydratedTrainerProgramPhase[];
  onComplete: OnProgramComplete;
  rangeStart: string;
  rangeEnd: string;
  overridesByDate: Map<string, DateOverrideInput>;
}): ProjectedDay[] {
  const { startsOn, phases, onComplete, rangeStart, rangeEnd, overridesByDate } = input;
  const days: ProjectedDay[] = [];

  const dayCount = daysBetween(rangeStart, rangeEnd) + 1;
  for (let i = 0; i < dayCount; i++) {
    const date = addDays(rangeStart, i);
    const dayOfWeek = dayOfWeekOf(date);
    const override = overridesByDate.get(date);
    const resolved = resolvePhaseForDate(date, startsOn, phases, onComplete);

    if (override) {
      days.push({
        date,
        dayOfWeek,
        source: "override",
        phaseId: resolved?.phase.id ?? null,
        phaseName: resolved?.phase.name ?? null,
        weekInPhase: resolved?.weekInPhase ?? null,
        sessionName: override.isRestDay ? "Rest (moved)" : "Custom",
        exercises: override.isRestDay ? [] : override.exercises,
      });
      continue;
    }

    if (!resolved) {
      days.push({
        date,
        dayOfWeek,
        source: "not_started",
        phaseId: null,
        phaseName: null,
        weekInPhase: null,
        sessionName: null,
        exercises: [],
      });
      continue;
    }

    const session = resolved.phase.sessions.find((s) => s.dayOfWeek === dayOfWeek);
    if (!session) {
      days.push({
        date,
        dayOfWeek,
        source: "rest",
        phaseId: resolved.phase.id,
        phaseName: resolved.phase.name,
        weekInPhase: resolved.weekInPhase,
        sessionName: null,
        exercises: [],
      });
      continue;
    }

    days.push({
      date,
      dayOfWeek,
      source: "template",
      phaseId: resolved.phase.id,
      phaseName: resolved.phase.name,
      weekInPhase: resolved.weekInPhase,
      sessionName: session.name,
      exercises: session.exercises
        .slice()
        .sort((a, b) => a.exerciseOrder - b.exerciseOrder)
        .map((ex) => ({
          exerciseId: ex.exerciseId,
          sets: ex.sets,
          repsMin: ex.repsMin,
          repsMax: ex.repsMax,
          intensityType: ex.intensityType,
          intensityValue: ex.intensityValue,
          durationMinutes: ex.durationMinutes,
          cardioIntensity: ex.cardioIntensity,
          coachingNotes: ex.coachingNotes,
          sourceSessionExerciseId: ex.id,
        })),
    });
  }

  return days;
}
