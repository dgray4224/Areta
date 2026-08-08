import type { Blueprint, SlotSpec } from "./types";

/** Wellbeing blueprint -- the gentlest track. Methodology: ACSM
 * "start low, go slow" progression with sub-maximal efforts throughout;
 * no plyometrics, no high-intensity conditioning, no loaded spinal
 * flexion. Emphasis on movement quality, easy aerobic work, and
 * bodyweight-leaning strength patterns. */

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
  goal: "move_and_feel_better",
  slugBase: "move-feel-better",
  name: "Move & Feel Better",
  description:
    "Gentle, sustainable training for feeling better day to day: easy aerobic work, comfortable full-body strength patterns, and core control -- every effort deliberately sub-maximal.",
  phases: [
    { name: "Ease In", focus: "Re-establish comfortable, pain-free movement", lengthWeeks: 4, intensityStyle: "RPE 5-6 throughout" },
    { name: "Gentle Build", focus: "Slightly longer sessions and a little more load, then an easy week", lengthWeeks: 4, intensityStyle: "RPE 6-7, final week extra easy" },
  ],
  tiers: {
    beginner: {
      days: [2, 3],
      sessions: [
        {
          name: "Gentle Strength",
          type: "strength",
          slots: [
            r("Squat pattern", "squat", 1, [2, 3], [8, 12], "RPE 5-6 -- stop well short of strain", 90),
            r("Hip extension", "hip_extension", 2, [2, 3], [10, 15], "RPE 5-6", 75),
            r("Horizontal push", "horizontal_push", 3, [2, 3], [8, 12], "RPE 5-6", 90),
            r("Core stability", "core_stability", 4, [2, 3], [8, 12], "gentle, controlled", 60),
          ],
        },
        {
          name: "Easy Movement",
          type: "conditioning",
          slots: [cardio("Easy aerobic movement", "bike", 1, [20, 30], "very easy -- could hold a full conversation")],
        },
      ],
    },
    intermediate: {
      days: [3, 4],
      sessions: [
        {
          name: "Gentle Strength A",
          type: "strength",
          slots: [
            r("Squat pattern", "squat", 1, [2, 3], [8, 12], "RPE 6", 90),
            r("Hip extension", "hip_extension", 2, [2, 3], [10, 15], "RPE 6", 75),
            r("Horizontal push", "horizontal_push", 3, [2, 3], [8, 12], "RPE 6", 90),
            r("Core stability", "core_stability", 4, [2, 3], [10, 15], "gentle, controlled", 60),
          ],
        },
        {
          name: "Gentle Strength B",
          type: "strength",
          slots: [
            r("Single-leg work", "lunge", 1, [2, 3], [8, 10], "RPE 6", 90),
            r("Horizontal pull", "horizontal_pull", 2, [2, 3], [8, 12], "RPE 6", 90),
            r("Hamstrings", "hamstring_isolation", 3, [2, 3], [8, 12], "RPE 6", 75),
            r("Core stability", "core_stability", 4, [2, 3], [10, 15], "gentle, controlled", 60),
          ],
        },
        {
          name: "Easy Movement",
          type: "conditioning",
          slots: [cardio("Easy aerobic movement", "bike", 1, [25, 40], "very easy -- conversational throughout")],
        },
      ],
    },
    advanced: {
      days: [3, 5],
      sessions: [
        {
          name: "Gentle Strength A",
          type: "strength",
          slots: [
            r("Squat pattern", "squat", 1, [2, 4], [8, 12], "RPE 6-7", 90),
            r("Hip extension", "hip_extension", 2, [2, 3], [10, 15], "RPE 6-7", 75),
            r("Horizontal push", "horizontal_push", 3, [2, 3], [8, 12], "RPE 6-7", 90),
            r("Loaded carry", "carry", 4, [2, 3], [1, 1], "moderate, 30-40m per set", 90),
            r("Core stability", "core_stability", 5, [2, 3], [10, 15], "gentle, controlled", 60),
          ],
        },
        {
          name: "Gentle Strength B",
          type: "strength",
          slots: [
            r("Single-leg work", "lunge", 1, [2, 3], [8, 12], "RPE 6-7", 90),
            r("Horizontal pull", "horizontal_pull", 2, [2, 3], [8, 12], "RPE 6-7", 90),
            r("Vertical push", "vertical_push", 3, [2, 3], [8, 12], "RPE 6-7", 90),
            r("Hamstrings", "hamstring_isolation", 4, [2, 3], [8, 12], "RPE 7", 75),
            r("Core stability", "core_stability", 5, [2, 3], [10, 15], "gentle, controlled", 60),
          ],
        },
        {
          name: "Easy Movement",
          type: "conditioning",
          slots: [cardio("Easy aerobic movement", "bike", 1, [30, 45], "very easy -- conversational throughout")],
        },
        {
          name: "Easy Movement 2",
          type: "conditioning",
          slots: [cardio("Easy aerobic movement", "bike", 1, [30, 45], "very easy -- conversational throughout")],
        },
      ],
    },
  },
  contexts: ["full_gym", "home_basic_equipment", "home_no_equipment", "outdoors"],
  bands: ["15_20", "30", "45", "60_plus"],
  contextSwap: {
    home_no_equipment: {
      horizontal_pull: "core_stability",
      hamstring_isolation: "hip_extension",
      carry: "core_stability",
      vertical_push: "horizontal_push",
      bike: "run",
    },
    outdoors: {
      horizontal_pull: "core_stability",
      hamstring_isolation: "hip_extension",
      carry: "core_stability",
      vertical_push: "horizontal_push",
      bike: "run",
    },
  },
};
