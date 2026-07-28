/** Pure, deterministic (CLAUDE.md §7 Layer 3) duration calculation, used
 * when a bedtime and wake time are given but total duration isn't typed
 * explicitly. */
export function computeSleepDurationMinutes(bedtimeIso: string, wakeTimeIso: string): number {
  const bed = new Date(bedtimeIso).getTime();
  const wake = new Date(wakeTimeIso).getTime();
  return Math.round((wake - bed) / 60000);
}
