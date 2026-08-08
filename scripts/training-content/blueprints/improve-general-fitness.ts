import type { Blueprint, SlotSpec } from "./types";

/** General-fitness blueprint. Methodology: ACSM FITT-VP -- balanced
 * full-body resistance work 2-3+ days/week plus an aerobic dose toward
 * the 150-minute weekly baseline, progressed "start low, go slow"
 * (migration 0090's aerobic_weekly_dose / novice_full_body_frequency /
 * start_low_go_slow claims). */

const r = (
  label: string,
  pattern: string,
  priority: number,
  sets: [number, number],
  reps: [number, number],
  effort: string,
  restSeconds: number
): SlotSpec => ({ label, pattern, modality: "resistance", priority, sets, reps, effort, restSeconds });

const cardio = (label: string, pattern: string, priority: number, minutes: [number, number], effort: string): SlotSpec => ({
  label,
  pattern,
  modality: "aerobic",
  priority,
  minutes,
  effort,
});

export const blueprint: Blueprint = {
  goal: "improve_general_fitness",
  slugBase: "general-fitness",
  name: "General Fitness",
  description:
    "Balanced whole-body fitness: full-body strength sessions covering every major movement pattern plus regular aerobic work, meeting public-health activity guidelines and progressing conservatively.",
  phases: [
    { name: "Foundation", focus: "Build the habit and cover every movement pattern", lengthWeeks: 4, intensityStyle: "RPE 6-7, easy aerobic" },
    { name: "Progress", focus: "Nudge load, reps, and aerobic minutes upward, then deload", lengthWeeks: 4, intensityStyle: "RPE 7-8, aerobic minutes grow, final week deload" },
  ],
  tiers: {
    beginner: {
      days: [2, 3],
      sessions: [
        {
          name: "Full Body",
          type: "strength",
          slots: [
            r("Squat pattern", "squat", 1, [2, 3], [8, 12], "RPE 6-7", 90),
            r("Horizontal push", "horizontal_push", 2, [2, 3], [8, 12], "RPE 6-7", 90),
            r("Horizontal pull", "horizontal_pull", 3, [2, 3], [8, 12], "RPE 6-7", 90),
            r("Core stability", "core_stability", 4, [2, 3], [10, 15], "controlled", 60),
          ],
        },
        {
          name: "Aerobic Session",
          type: "conditioning",
          slots: [cardio("Steady aerobic work", "bike", 1, [25, 35], "easy to moderate -- conversational")],
        },
      ],
    },
    intermediate: {
      days: [3, 4],
      sessions: [
        {
          name: "Full Body A",
          type: "strength",
          slots: [
            r("Squat pattern", "squat", 1, [3, 4], [8, 12], "RPE 7", 90),
            r("Horizontal push", "horizontal_push", 2, [3, 4], [8, 12], "RPE 7", 90),
            r("Horizontal pull", "horizontal_pull", 3, [3, 4], [8, 12], "RPE 7", 90),
            r("Hip extension", "hip_extension", 4, [2, 3], [10, 15], "RPE 7-8", 60),
            r("Core stability", "core_stability", 5, [2, 3], [10, 15], "controlled", 45),
          ],
        },
        {
          name: "Full Body B",
          type: "strength",
          slots: [
            r("Hinge pattern", "hinge", 1, [3, 4], [8, 12], "RPE 7", 90),
            r("Vertical push", "vertical_push", 2, [3, 4], [8, 12], "RPE 7", 90),
            r("Vertical pull", "vertical_pull", 3, [3, 4], [8, 12], "RPE 7", 90),
            r("Single-leg work", "lunge", 4, [2, 3], [8, 12], "RPE 7-8", 75),
            r("Core rotation", "core_rotation", 5, [2, 3], [10, 15], "controlled", 45),
          ],
        },
        {
          name: "Aerobic Session",
          type: "conditioning",
          slots: [cardio("Steady aerobic work", "bike", 1, [30, 45], "easy to moderate -- conversational")],
        },
      ],
    },
    advanced: {
      days: [4, 5],
      sessions: [
        {
          name: "Full Body A",
          type: "strength",
          slots: [
            r("Squat pattern", "squat", 1, [3, 5], [6, 10], "RPE 7-8", 105),
            r("Horizontal push", "horizontal_push", 2, [3, 4], [6, 10], "RPE 7-8", 105),
            r("Horizontal pull", "horizontal_pull", 3, [3, 4], [8, 12], "RPE 8", 90),
            r("Loaded carry", "carry", 4, [2, 3], [1, 1], "heavy, 30-40m per set", 90),
            r("Core stability", "core_stability", 5, [2, 3], [10, 15], "controlled", 45),
          ],
        },
        {
          name: "Full Body B",
          type: "strength",
          slots: [
            r("Hinge pattern", "hinge", 1, [3, 5], [6, 10], "RPE 7-8", 105),
            r("Vertical push", "vertical_push", 2, [3, 4], [8, 12], "RPE 8", 90),
            r("Vertical pull", "vertical_pull", 3, [3, 4], [8, 12], "RPE 8", 90),
            r("Single-leg work", "lunge", 4, [3, 4], [8, 12], "RPE 8", 75),
            r("Core anti-extension", "core_anti_extension", 5, [2, 3], [8, 12], "controlled", 45),
          ],
        },
        {
          name: "Steady Aerobic",
          type: "conditioning",
          slots: [cardio("Steady aerobic work", "bike", 1, [35, 50], "easy -- conversational, zone 2")],
        },
        {
          name: "Intervals",
          type: "conditioning",
          slots: [cardio("Interval conditioning", "conditioning", 1, [20, 30], "hard efforts with full recoveries")],
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
      vertical_push: "horizontal_push",
      carry: "core_stability",
      bike: "run",
    },
    outdoors: {
      horizontal_pull: "core_stability",
      vertical_pull: "core_stability",
      hinge: "hip_extension",
      vertical_push: "horizontal_push",
      carry: "core_stability",
      bike: "run",
    },
  },
};
