import type { Blueprint, SlotSpec } from "./types";

/** Fat-loss blueprint. Methodology: resistance training to retain lean
 * mass on a deficit (RP volume landmarks apply -- migration 0090's
 * weekly_volume_hypertrophy claim covers lose_fat too) plus an aerobic
 * dose meeting the ACSM 150-minute weekly baseline
 * (aerobic_weekly_dose claim), mixed steady-state and intervals. */

const r = (
  label: string,
  pattern: string,
  priority: number,
  sets: [number, number],
  reps: [number, number],
  effort: string,
  restSeconds: number
): SlotSpec => ({ label, pattern, modality: "resistance", priority, sets, reps, effort, restSeconds });

const cardio = (label: string, pattern: string, priority: number, minutes: [number, number], effort: string, notes?: string): SlotSpec => ({
  label,
  pattern,
  modality: "aerobic",
  priority,
  minutes,
  effort,
  notes,
});

export const blueprint: Blueprint = {
  goal: "lose_fat",
  slugBase: "lose-fat",
  name: "Lose Fat",
  description:
    "Fat-loss training that protects muscle: full-body resistance work at moderate volumes plus a weekly aerobic dose meeting public-health guidelines, mixing steady-state and interval conditioning.",
  phases: [
    { name: "Foundation", focus: "Consistent training rhythm and moderate volumes", lengthWeeks: 4, intensityStyle: "RPE 6-8, steady aerobic base" },
    { name: "Progress", focus: "Raise training density and conditioning intensity, then deload", lengthWeeks: 4, intensityStyle: "RPE 7-9, intervals sharpen, final week deload" },
  ],
  tiers: {
    beginner: {
      days: [2, 3],
      sessions: [
        {
          name: "Full Body Strength",
          type: "strength",
          slots: [
            r("Squat pattern", "squat", 1, [2, 3], [10, 15], "RPE 6-7", 75),
            r("Horizontal push", "horizontal_push", 2, [2, 3], [10, 15], "RPE 6-7", 75),
            r("Horizontal pull", "horizontal_pull", 3, [2, 3], [10, 15], "RPE 6-7", 75),
            r("Hip extension", "hip_extension", 4, [2, 3], [12, 15], "RPE 7", 60),
            r("Core stability", "core_stability", 5, [2, 3], [10, 15], "controlled", 45),
          ],
        },
        {
          name: "Conditioning",
          type: "conditioning",
          slots: [
            cardio("Steady aerobic work", "bike", 1, [25, 35], "moderate -- can speak in short sentences"),
            r("Core stability finisher", "core_stability", 2, [2, 3], [10, 15], "controlled", 45),
          ],
        },
      ],
    },
    intermediate: {
      days: [3, 4],
      sessions: [
        {
          name: "Strength A",
          type: "strength",
          slots: [
            r("Squat pattern", "squat", 1, [3, 4], [8, 12], "RPE 7-8", 90),
            r("Horizontal push", "horizontal_push", 2, [3, 4], [8, 12], "RPE 7-8", 90),
            r("Horizontal pull", "horizontal_pull", 3, [3, 4], [8, 12], "RPE 7-8", 90),
            r("Loaded carry", "carry", 4, [2, 3], [1, 1], "heavy, 30-40m per set", 90),
            r("Core stability", "core_stability", 5, [2, 3], [10, 15], "controlled", 45),
          ],
        },
        {
          name: "Strength B",
          type: "strength",
          slots: [
            r("Hinge pattern", "hinge", 1, [3, 4], [8, 12], "RPE 7-8", 90),
            r("Vertical push", "vertical_push", 2, [3, 4], [8, 12], "RPE 7-8", 90),
            r("Vertical pull", "vertical_pull", 3, [3, 4], [8, 12], "RPE 7-8", 90),
            r("Single-leg work", "lunge", 4, [2, 3], [10, 12], "RPE 8", 75),
            r("Core rotation", "core_rotation", 5, [2, 3], [10, 15], "controlled", 45),
          ],
        },
        {
          name: "Intervals",
          type: "conditioning",
          slots: [
            cardio("Interval conditioning", "conditioning", 1, [20, 30], "hard efforts with full recoveries"),
            r("Core stability finisher", "core_stability", 2, [2, 3], [10, 15], "controlled", 45),
          ],
        },
        {
          name: "Steady State",
          type: "conditioning",
          slots: [cardio("Steady aerobic work", "bike", 1, [30, 45], "easy -- conversational")],
        },
      ],
    },
    advanced: {
      days: [4, 6],
      sessions: [
        {
          name: "Strength A",
          type: "strength",
          slots: [
            r("Squat pattern", "squat", 1, [3, 5], [6, 10], "RPE 8", 105),
            r("Horizontal push", "horizontal_push", 2, [3, 5], [6, 10], "RPE 8", 105),
            r("Horizontal pull", "horizontal_pull", 3, [3, 5], [8, 12], "RPE 8", 90),
            r("Loaded carry", "carry", 4, [2, 4], [1, 1], "heavy, 30-40m per set", 90),
            r("Core anti-extension", "core_anti_extension", 5, [2, 3], [8, 12], "controlled", 45),
          ],
        },
        {
          name: "Strength B",
          type: "strength",
          slots: [
            r("Hinge pattern", "hinge", 1, [3, 5], [6, 10], "RPE 8", 105),
            r("Vertical push", "vertical_push", 2, [3, 4], [8, 12], "RPE 8", 90),
            r("Vertical pull", "vertical_pull", 3, [3, 5], [8, 12], "RPE 8", 90),
            r("Single-leg work", "lunge", 4, [3, 4], [8, 12], "RPE 8", 75),
            r("Core rotation", "core_rotation", 5, [2, 3], [12, 15], "controlled", 45),
          ],
        },
        {
          name: "Hard Intervals",
          type: "conditioning",
          slots: [
            cardio("Interval conditioning", "conditioning", 1, [20, 30], "hard repeats, full recoveries"),
          ],
        },
        {
          name: "Steady State",
          type: "conditioning",
          slots: [cardio("Steady aerobic work", "bike", 1, [35, 50], "easy -- conversational, zone 2")],
        },
      ],
    },
  },
  contexts: ["full_gym", "home_basic_equipment", "home_no_equipment", "outdoors"],
  bands: ["15_20", "30", "45", "60_plus"],
  contextSwap: {
    home_no_equipment: {
      horizontal_pull: "core_stability",
      vertical_pull: "core_stability",
      hinge: "hip_extension",
      carry: "core_stability",
      vertical_push: "horizontal_push",
      bike: "run",
    },
    outdoors: {
      bike: "run",
      horizontal_pull: "core_stability",
      vertical_pull: "core_stability",
      hinge: "hip_extension",
      carry: "core_stability",
      vertical_push: "horizontal_push",
    },
  },
};
