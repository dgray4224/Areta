import { daysBetween } from "@/domains/trainerprogram/calendar-projection";

/** Given a program's phases (sorted by phaseOrder) and a starts_on date,
 * resolves which phase + week-within-phase "today" falls into. Pure
 * arithmetic, the same core loop as domains/trainerprogram/calendar-
 * projection.ts#resolvePhaseForDate but without that module's
 * day-of-week/override machinery -- nutrition has no calendar UI yet, so
 * there's nothing here beyond "which phase is the client currently on"
 * to compute. No auto-repeat/freeze once the phase cycle runs out
 * (matches migration 0083's decision, same as the workout side's
 * "phases_complete" state) -- returns null in that case rather than
 * looping back or freezing.
 *
 * Lives in its own module (moved out of a private helper in
 * domains/trainer/service.ts, 2026-08-07) specifically so
 * domains/trainermealprogram/materialize.ts can use it too without a
 * circular import -- trainer/service.ts calls into materialize.ts (to
 * re-sync a client's plan after an assignment/portion/target change),
 * never the other way around. */
export function resolveMealProgramPhase(
  startsOn: string,
  phases: { id: string; name: string; lengthWeeks: number }[],
  today: string
): { phaseId: string; phaseName: string; weekInPhase: number } | null {
  if (phases.length === 0 || today < startsOn) return null;
  const weeksSinceStart = Math.floor(daysBetween(startsOn, today) / 7);
  const totalCycleWeeks = phases.reduce((sum, p) => sum + p.lengthWeeks, 0);
  if (totalCycleWeeks <= 0 || weeksSinceStart >= totalCycleWeeks) return null;

  let remaining = weeksSinceStart;
  for (const phase of phases) {
    if (remaining < phase.lengthWeeks) {
      return { phaseId: phase.id, phaseName: phase.name, weekInPhase: remaining + 1 };
    }
    remaining -= phase.lengthWeeks;
  }
  return null;
}
