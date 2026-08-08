import type { Blueprint, SlotSpec } from "./types";

/** Endurance blueprint. Methodology: polarized/80-20 intensity
 * distribution (Seiler -- most volume easy, ~20% high intensity) and
 * Daniels' easy-mileage-plus-weekly-long-run structure (migration
 * 0090's polarized_intensity_distribution / easy_mileage_plus_long_run
 * claims). Advanced adds a strength-support session (optional slot
 * trimming keeps it honest at short bands). */

const cardio = (label: string, pattern: string, priority: number, minutes: [number, number], effort: string, notes?: string): SlotSpec => ({
  label,
  pattern,
  modality: "aerobic",
  priority,
  minutes,
  effort,
  notes,
});

const r = (
  label: string,
  pattern: string,
  priority: number,
  sets: [number, number],
  reps: [number, number],
  effort: string,
  restSeconds: number
): SlotSpec => ({ label, pattern, modality: "resistance", priority, sets, reps, effort, restSeconds });

export const blueprint: Blueprint = {
  goal: "improve_endurance",
  slugBase: "improve-endurance",
  name: "Improve Endurance",
  description:
    "Aerobic development on the 80/20 principle: most weekly volume at an easy, conversational intensity anchored by one long session, with a small, deliberate dose of quality work.",
  phases: [
    { name: "Aerobic Base", focus: "Grow easy volume; keep almost everything conversational", lengthWeeks: 4, intensityStyle: "~90% easy volume, strides only" },
    { name: "Sharpen", focus: "Keep the easy base, add one weekly quality session, then absorb", lengthWeeks: 4, intensityStyle: "~80/20 easy-to-hard split, final week reduced" },
  ],
  tiers: {
    beginner: {
      days: [2, 3],
      sessions: [
        { name: "Easy Session", type: "endurance", slots: [cardio("Easy aerobic", "run", 1, [25, 35], "easy -- fully conversational")] },
        { name: "Easy Session 2", type: "endurance", slots: [cardio("Easy aerobic", "run", 1, [25, 35], "easy -- fully conversational")] },
        { name: "Long Session", type: "endurance", slots: [cardio("Long easy effort", "run", 1, [40, 60], "easy -- the week's cornerstone", "Anchor session: longest easy effort of the week")] },
      ],
    },
    intermediate: {
      days: [3, 5],
      sessions: [
        { name: "Easy Session", type: "endurance", slots: [cardio("Easy aerobic", "run", 1, [30, 45], "easy -- fully conversational")] },
        { name: "Easy Session 2", type: "endurance", slots: [cardio("Easy aerobic", "run", 1, [30, 45], "easy -- fully conversational")] },
        { name: "Quality Session", type: "endurance", slots: [cardio("Tempo / threshold work", "run", 1, [25, 40], "comfortably hard -- tempo effort", "The week's ~20% hard dose")] },
        { name: "Long Session", type: "endurance", slots: [cardio("Long easy effort", "run", 1, [50, 75], "easy -- the week's cornerstone")] },
      ],
    },
    advanced: {
      days: [4, 6],
      sessions: [
        { name: "Easy Session", type: "endurance", slots: [cardio("Easy aerobic", "run", 1, [35, 50], "easy -- fully conversational")] },
        { name: "Easy Session 2", type: "endurance", slots: [cardio("Easy aerobic", "run", 1, [35, 50], "easy -- fully conversational")] },
        { name: "Interval Session", type: "endurance", slots: [cardio("Interval repeats", "run", 1, [30, 45], "hard -- 5k-effort repeats with easy recoveries")] },
        { name: "Long Session", type: "endurance", slots: [cardio("Long easy effort", "run", 1, [60, 90], "easy -- the week's cornerstone")] },
        {
          name: "Strength Support",
          type: "strength",
          slots: [
            r("Squat pattern", "squat", 1, [2, 3], [6, 10], "RPE 7", 120),
            r("Hinge pattern", "hinge", 2, [2, 3], [6, 10], "RPE 7", 120),
            r("Core stability", "core_stability", 3, [2, 3], [10, 15], "controlled", 60),
          ],
        },
      ],
    },
  },
  contexts: ["outdoors", "full_gym", "home_basic_equipment"],
  bands: ["15_20", "30", "45", "60_plus"],
  contextSwap: {
    full_gym: {},
    home_basic_equipment: { run: "bike" },
  },
};
