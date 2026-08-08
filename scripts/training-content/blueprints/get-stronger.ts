import type { Blueprint, SlotSpec } from "./types";

/** Maximal-strength blueprint. Methodology: ACSM progression models --
 * multi-joint lifts at 1-6 reps, 3+ sets, full rest, 2-for-2 load
 * progression (migration 0090's strength_loading /
 * two_for_two_load_progression claims); novices start full-body at
 * moderate loads (novice_full_body_frequency). */

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
  goal: "get_stronger",
  slugBase: "get-stronger",
  name: "Get Stronger",
  description:
    "Strength-focused training centered on heavy multi-joint lifts with full rest, conservative load progression (the 2-for-2 rule), and accessory work supporting the main lifts.",
  phases: [
    { name: "Base Strength", focus: "Build work capacity and technique on the main lifts", lengthWeeks: 4, intensityStyle: "RPE 7, linear load progression" },
    { name: "Peak Strength", focus: "Heavier top sets on the main lifts, then deload", lengthWeeks: 4, intensityStyle: "RPE 8-9 top sets, final week deload" },
  ],
  tiers: {
    beginner: {
      days: [2, 3],
      sessions: [
        {
          name: "Full Body A",
          type: "strength",
          slots: [
            r("Squat pattern (main)", "squat", 1, [3, 4], [5, 8], "RPE 6-7", 150),
            r("Horizontal push (main)", "horizontal_push", 2, [3, 4], [5, 8], "RPE 6-7", 150),
            r("Horizontal pull", "horizontal_pull", 3, [3, 4], [6, 10], "RPE 7", 120),
            r("Core stability", "core_stability", 4, [2, 3], [10, 15], "controlled", 60),
          ],
        },
        {
          name: "Full Body B",
          type: "strength",
          slots: [
            r("Hinge pattern (main)", "hinge", 1, [3, 4], [5, 8], "RPE 6-7", 180),
            r("Vertical push (main)", "vertical_push", 2, [3, 4], [5, 8], "RPE 6-7", 150),
            r("Vertical pull", "vertical_pull", 3, [3, 4], [6, 10], "RPE 7", 120),
            r("Core anti-extension", "core_anti_extension", 4, [2, 3], [8, 12], "controlled", 60),
          ],
        },
      ],
    },
    intermediate: {
      days: [3, 4],
      sessions: [
        {
          name: "Squat Day",
          type: "strength",
          slots: [
            r("Squat (main)", "squat", 1, [3, 5], [3, 6], "RPE 7-8", 180),
            r("Secondary press", "horizontal_push", 2, [3, 4], [6, 8], "RPE 7", 120),
            r("Single-leg accessory", "lunge", 3, [2, 3], [8, 10], "RPE 7-8", 90),
            r("Core stability", "core_stability", 4, [2, 3], [10, 15], "controlled", 60),
          ],
        },
        {
          name: "Bench Day",
          type: "strength",
          slots: [
            r("Horizontal push (main)", "horizontal_push", 1, [3, 5], [3, 6], "RPE 7-8", 180),
            r("Horizontal pull", "horizontal_pull", 2, [3, 4], [6, 10], "RPE 7-8", 120),
            r("Triceps accessory", "elbow_extension", 3, [2, 4], [8, 12], "RPE 8", 60),
            r("Rear delts", "shoulder_isolation", 4, [2, 3], [12, 15], "RPE 8", 45),
          ],
        },
        {
          name: "Deadlift Day",
          type: "strength",
          slots: [
            r("Hinge (main)", "hinge", 1, [3, 5], [3, 6], "RPE 7-8", 210),
            r("Vertical pull", "vertical_pull", 2, [3, 4], [6, 10], "RPE 7-8", 120),
            r("Hip extension accessory", "hip_extension", 3, [2, 4], [8, 12], "RPE 8", 90),
            r("Core anti-extension", "core_anti_extension", 4, [2, 3], [8, 12], "controlled", 60),
          ],
        },
      ],
    },
    advanced: {
      days: [3, 5],
      sessions: [
        {
          name: "Squat Day",
          type: "strength",
          slots: [
            r("Squat (top sets)", "squat", 1, [3, 5], [1, 5], "RPE 8-9", 240),
            r("Squat back-off / secondary", "squat", 2, [2, 4], [4, 6], "RPE 7-8", 180),
            r("Single-leg accessory", "lunge", 3, [2, 3], [6, 10], "RPE 8", 90),
            r("Hamstrings", "hamstring_isolation", 4, [2, 3], [8, 12], "RPE 8", 60),
            r("Core stability", "core_stability", 5, [2, 3], [10, 15], "controlled", 60),
          ],
        },
        {
          name: "Bench Day",
          type: "strength",
          slots: [
            r("Horizontal push (top sets)", "horizontal_push", 1, [3, 5], [1, 5], "RPE 8-9", 240),
            r("Incline / secondary press", "incline_push", 2, [2, 4], [4, 8], "RPE 8", 150),
            r("Horizontal pull", "horizontal_pull", 3, [3, 4], [6, 10], "RPE 8", 120),
            r("Triceps accessory", "elbow_extension", 4, [2, 4], [8, 12], "RPE 8-9", 60),
            r("Grip", "grip", 5, [2, 3], [8, 12], "hard hold", 60),
          ],
        },
        {
          name: "Deadlift Day",
          type: "strength",
          slots: [
            r("Hinge (top sets)", "hinge", 1, [3, 5], [1, 5], "RPE 8-9", 240),
            r("Hip extension accessory", "hip_extension", 2, [2, 4], [6, 10], "RPE 8", 120),
            r("Vertical pull", "vertical_pull", 3, [3, 4], [6, 10], "RPE 8", 120),
            r("Core anti-extension", "core_anti_extension", 4, [2, 3], [8, 12], "controlled", 60),
          ],
        },
        {
          name: "Press Day",
          type: "strength",
          slots: [
            r("Vertical push (top sets)", "vertical_push", 1, [3, 5], [2, 6], "RPE 8-9", 210),
            r("Horizontal push (volume)", "horizontal_push", 2, [2, 4], [6, 8], "RPE 7-8", 150),
            r("Vertical pull", "vertical_pull", 3, [3, 4], [6, 10], "RPE 8", 120),
            r("Side delts", "shoulder_isolation", 4, [2, 3], [10, 15], "RPE 8-9", 45),
            r("Biceps", "elbow_flexion", 5, [2, 3], [8, 12], "RPE 8-9", 45),
          ],
        },
      ],
    },
  },
  contexts: ["full_gym", "home_basic_equipment"],
  bands: ["30", "45", "60_plus"],
};
