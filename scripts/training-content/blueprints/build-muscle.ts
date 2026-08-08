import type { Blueprint, SlotSpec } from "./types";

/** Hypertrophy blueprint. Methodology: RP volume landmarks (start near
 * MEV, ramp sets across the phase -- the sets [min,max] ranges are the
 * ramp) + Schoenfeld's repetition continuum (6-12 default, wider on
 * isolation). See migration 0090's weekly_volume_hypertrophy /
 * hypertrophy_rep_range / volume_ramp_and_deload claims. */

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
  goal: "build_muscle",
  slugBase: "build-muscle",
  name: "Build Muscle",
  description:
    "Hypertrophy-focused training built on volume-landmark progression: start each phase near minimum effective volume and add sets week over week, using moderate rep ranges taken close to failure.",
  phases: [
    { name: "Base Volume", focus: "Establish technique and baseline weekly volume", lengthWeeks: 4, intensityStyle: "RPE 7-8, sets ramp weekly" },
    { name: "Build Volume", focus: "Push volume toward maximum adaptive volume, then deload", lengthWeeks: 4, intensityStyle: "RPE 8-9, sets ramp weekly, final week deload" },
  ],
  tiers: {
    beginner: {
      days: [2, 3],
      sessions: [
        {
          name: "Full Body A",
          type: "strength",
          slots: [
            r("Squat pattern", "squat", 1, [2, 4], [8, 12], "RPE 7", 90),
            r("Horizontal push", "horizontal_push", 2, [2, 4], [8, 12], "RPE 7", 90),
            r("Horizontal pull", "horizontal_pull", 3, [2, 4], [8, 12], "RPE 7", 90),
            r("Hip extension", "hip_extension", 4, [2, 3], [10, 15], "RPE 7-8", 60),
            r("Core stability", "core_stability", 5, [2, 3], [10, 15], "controlled", 60),
          ],
        },
        {
          name: "Full Body B",
          type: "strength",
          slots: [
            r("Hinge pattern", "hinge", 1, [2, 4], [8, 12], "RPE 7", 90),
            r("Vertical push", "vertical_push", 2, [2, 4], [8, 12], "RPE 7", 90),
            r("Vertical pull", "vertical_pull", 3, [2, 4], [8, 12], "RPE 7", 90),
            r("Single-leg work", "lunge", 4, [2, 3], [10, 12], "RPE 7", 60),
            r("Biceps", "elbow_flexion", 5, [2, 3], [10, 15], "RPE 8", 45),
          ],
        },
      ],
    },
    intermediate: {
      days: [3, 4],
      sessions: [
        {
          name: "Upper A",
          type: "strength",
          slots: [
            r("Horizontal push", "horizontal_push", 1, [3, 5], [6, 10], "RPE 7-8", 120),
            r("Horizontal pull", "horizontal_pull", 2, [3, 5], [8, 12], "RPE 7-8", 90),
            r("Vertical push", "vertical_push", 3, [3, 4], [8, 12], "RPE 8", 90),
            r("Biceps", "elbow_flexion", 4, [2, 4], [10, 15], "RPE 8-9", 45),
            r("Triceps", "elbow_extension", 5, [2, 4], [10, 15], "RPE 8-9", 45),
            r("Side delts", "shoulder_isolation", 6, [2, 4], [12, 20], "RPE 8-9", 45),
          ],
        },
        {
          name: "Lower A",
          type: "strength",
          slots: [
            r("Squat pattern", "squat", 1, [3, 5], [6, 10], "RPE 7-8", 150),
            r("Hinge pattern", "hinge", 2, [3, 4], [8, 12], "RPE 7-8", 120),
            r("Single-leg work", "lunge", 3, [2, 4], [8, 12], "RPE 8", 90),
            r("Hamstrings", "hamstring_isolation", 4, [2, 4], [10, 15], "RPE 8", 60),
            r("Calves", "calf_raise", 5, [3, 4], [10, 15], "RPE 8-9", 45),
            r("Core stability", "core_stability", 6, [2, 3], [10, 15], "controlled", 45),
          ],
        },
        {
          name: "Upper B",
          type: "strength",
          slots: [
            r("Vertical pull", "vertical_pull", 1, [3, 5], [6, 10], "RPE 7-8", 120),
            r("Incline push", "incline_push", 2, [3, 4], [8, 12], "RPE 8", 90),
            r("Chest isolation", "chest_isolation", 3, [2, 4], [12, 15], "RPE 8-9", 45),
            r("Rear delts / upper back", "horizontal_pull", 4, [2, 4], [12, 15], "RPE 8", 60),
            r("Biceps", "elbow_flexion", 5, [2, 3], [10, 15], "RPE 9", 45),
            r("Triceps", "elbow_extension", 6, [2, 3], [10, 15], "RPE 9", 45),
          ],
        },
        {
          name: "Lower B",
          type: "strength",
          slots: [
            r("Hinge pattern", "hinge", 1, [3, 5], [6, 10], "RPE 7-8", 150),
            r("Squat pattern", "squat", 2, [3, 4], [8, 12], "RPE 8", 120),
            r("Hip extension", "hip_extension", 3, [2, 4], [10, 15], "RPE 8", 60),
            r("Quads", "quad_isolation", 4, [2, 4], [10, 15], "RPE 8-9", 60),
            r("Calves", "calf_raise", 5, [3, 4], [12, 20], "RPE 8-9", 45),
            r("Core anti-extension", "core_anti_extension", 6, [2, 3], [8, 12], "controlled", 45),
          ],
        },
      ],
    },
    advanced: {
      days: [4, 6],
      sessions: [
        {
          name: "Push",
          type: "strength",
          slots: [
            r("Horizontal push", "horizontal_push", 1, [3, 5], [6, 10], "RPE 8", 120),
            r("Incline push", "incline_push", 2, [3, 5], [8, 12], "RPE 8", 90),
            r("Vertical push", "vertical_push", 3, [3, 4], [8, 12], "RPE 8-9", 90),
            r("Chest isolation", "chest_isolation", 4, [3, 4], [12, 15], "RPE 9", 45),
            r("Side delts", "shoulder_isolation", 5, [3, 5], [12, 20], "RPE 9", 45),
            r("Triceps", "elbow_extension", 6, [3, 5], [10, 15], "RPE 9", 45),
          ],
        },
        {
          name: "Pull",
          type: "strength",
          slots: [
            r("Vertical pull", "vertical_pull", 1, [3, 5], [6, 10], "RPE 8", 120),
            r("Horizontal pull", "horizontal_pull", 2, [3, 5], [8, 12], "RPE 8", 90),
            r("Rear delts", "shoulder_isolation", 3, [3, 4], [12, 20], "RPE 8-9", 45),
            r("Biceps", "elbow_flexion", 4, [3, 5], [8, 12], "RPE 9", 45),
            r("Grip / forearms", "grip", 5, [2, 3], [8, 12], "hard hold", 60),
            r("Core flexion", "core_flexion", 6, [2, 4], [8, 15], "controlled", 45),
          ],
        },
        {
          name: "Legs",
          type: "strength",
          slots: [
            r("Squat pattern", "squat", 1, [3, 5], [6, 10], "RPE 8", 150),
            r("Hinge pattern", "hinge", 2, [3, 4], [6, 10], "RPE 8", 150),
            r("Single-leg work", "lunge", 3, [3, 4], [8, 12], "RPE 8-9", 90),
            r("Hamstrings", "hamstring_isolation", 4, [3, 4], [10, 15], "RPE 9", 60),
            r("Quads", "quad_isolation", 5, [3, 4], [10, 15], "RPE 9", 60),
            r("Calves", "calf_raise", 6, [3, 5], [10, 20], "RPE 9", 45),
          ],
        },
        {
          name: "Upper (volume)",
          type: "strength",
          slots: [
            r("Horizontal push", "horizontal_push", 1, [3, 4], [8, 12], "RPE 8", 90),
            r("Horizontal pull", "horizontal_pull", 2, [3, 4], [8, 12], "RPE 8", 90),
            r("Vertical pull", "vertical_pull", 3, [3, 4], [8, 12], "RPE 8-9", 90),
            r("Side delts", "shoulder_isolation", 4, [3, 4], [15, 20], "RPE 9", 45),
            r("Biceps", "elbow_flexion", 5, [2, 4], [10, 15], "RPE 9", 45),
            r("Triceps", "elbow_extension", 6, [2, 4], [10, 15], "RPE 9", 45),
          ],
        },
      ],
    },
  },
  contexts: ["full_gym", "home_basic_equipment", "home_no_equipment"],
  bands: ["30", "45", "60_plus"],
  contextSwap: {
    home_no_equipment: {
      horizontal_pull: "core_stability",
      vertical_pull: "core_stability",
      hinge: "hip_extension",
      elbow_flexion: "elbow_extension",
      chest_isolation: "horizontal_push",
      shoulder_isolation: "core_stability",
      quad_isolation: "squat",
      calf_raise: "core_stability",
      incline_push: "horizontal_push",
      grip: "core_stability",
      hamstring_isolation: "hamstring_isolation",
    },
  },
};
