import type { PlannedExercise } from "@/domains/workoutplan/generate";
import type { FilledSlot, TemplatePhase } from "@/domains/recommendation/types";

/**
 * Turns a filled slot into a concrete weekly prescription. The RP-style
 * volume ramp (migration 0090's volume_ramp_and_deload claim): sets
 * start at the slot's authored sets_min in phase week 1 and add one set
 * per week up to sets_max; the phase's final week is a deload back to
 * sets_min at reduced effort. Aerobic durations ramp min -> max across
 * the phase the same way (staying inside the ~10% weekly-increase cap
 * by construction, since authored ranges are narrow).
 */
export function prescribeSlot(
  filled: FilledSlot,
  phase: Pick<TemplatePhase, "lengthWeeks">,
  phaseWeekNumber: number
): PlannedExercise {
  const { slot } = filled;
  const week = Math.max(1, Math.min(phaseWeekNumber, phase.lengthWeeks));
  const isDeloadWeek = phase.lengthWeeks > 1 && week === phase.lengthWeeks;

  let sets: number | null = null;
  if (slot.setsMin !== null) {
    const max = slot.setsMax ?? slot.setsMin;
    sets = isDeloadWeek ? slot.setsMin : Math.min(slot.setsMin + (week - 1), max);
  }

  let durationMinutes: number | null = null;
  if (slot.durationMinutesMin !== null) {
    const min = slot.durationMinutesMin;
    const max = slot.durationMinutesMax ?? min;
    const progress = phase.lengthWeeks > 1 ? (week - 1) / (phase.lengthWeeks - 1) : 1;
    durationMinutes = isDeloadWeek ? min : Math.round(min + (max - min) * progress);
  }

  // 'RPE 7-8' style effort targets map onto the existing rpe intensity
  // columns; everything else ('easy -- conversational') rides in
  // cardio_intensity / coaching notes.
  const rpeMatch = slot.effortTarget?.match(/RPE\s*([\d.]+(?:\s*-\s*[\d.]+)?)/i);
  const effortNote = isDeloadWeek && slot.effortTarget ? `${slot.effortTarget} (deload week: reduced)` : slot.effortTarget;

  return {
    exerciseId: filled.exerciseId,
    sets,
    reps: slot.repsMax ?? slot.repsMin,
    durationMinutes,
    programSessionExerciseId: null,
    repsMin: slot.repsMin,
    repsMax: slot.repsMax,
    intensityType: rpeMatch ? "rpe" : null,
    intensityValue: rpeMatch ? rpeMatch[1].replace(/\s/g, "") : null,
    cardioIntensity: slot.modality === "aerobic" ? effortNote : null,
    coachingNotes: buildCoachingNotes(filled, effortNote, isDeloadWeek),
    substituted: filled.provenance.relaxations.length > 0,
  };
}

function buildCoachingNotes(filled: FilledSlot, effortNote: string | null | undefined, isDeloadWeek: boolean): string | null {
  const parts: string[] = [];
  if (filled.slot.modality !== "aerobic" && effortNote && !/^RPE/i.test(effortNote)) parts.push(effortNote);
  if (isDeloadWeek) parts.push("Deload week — reduced volume on purpose; keep everything comfortable.");
  if (filled.slot.coachingNotes) parts.push(filled.slot.coachingNotes);
  if (filled.slot.restSeconds) parts.push(`Rest ~${filled.slot.restSeconds}s between sets.`);
  return parts.length > 0 ? parts.join(" ") : null;
}
