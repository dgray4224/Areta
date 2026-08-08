import type { Blueprint, SlotSpec } from "./types";

/** Event-training blueprint. Same 80/20 + long-session skeleton as
 * improve-endurance (Seiler / Daniels claims, migration 0090) with an
 * event-prep final phase. The event's discipline (run vs bike vs swim,
 * from goalDetail.eventType / preferredEnduranceActivity) is handled at
 * slot-fill time: aerobic patterns are an interchangeable group the
 * engine re-targets by the user's stated activity preference -- so one
 * blueprint covers running/cycling/multisport events without a variant
 * explosion here. */

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
  goal: "train_for_event",
  slugBase: "train-for-event",
  name: "Train for an Event",
  description:
    "Structured build toward a race or event: an easy-dominant aerobic base with one weekly long session, sharpened by event-specific quality work in the final phase.",
  phases: [
    { name: "Event Base", focus: "Grow easy volume and the weekly long session", lengthWeeks: 4, intensityStyle: "~90% easy volume" },
    { name: "Event Prep", focus: "Event-specific quality work on top of the base, then taper", lengthWeeks: 4, intensityStyle: "~80/20 split, final week tapered" },
  ],
  tiers: {
    beginner: {
      days: [3, 4],
      sessions: [
        { name: "Easy Session", type: "endurance", slots: [cardio("Easy aerobic", "run", 1, [25, 40], "easy -- fully conversational")] },
        { name: "Easy Session 2", type: "endurance", slots: [cardio("Easy aerobic", "run", 1, [25, 40], "easy -- fully conversational")] },
        { name: "Long Session", type: "endurance", slots: [cardio("Long easy effort", "run", 1, [45, 70], "easy -- builds toward event distance", "Anchor session: extend gradually toward the event demand")] },
      ],
    },
    intermediate: {
      days: [3, 5],
      sessions: [
        { name: "Easy Session", type: "endurance", slots: [cardio("Easy aerobic", "run", 1, [30, 45], "easy -- fully conversational")] },
        { name: "Easy Session 2", type: "endurance", slots: [cardio("Easy aerobic", "run", 1, [30, 45], "easy -- fully conversational")] },
        { name: "Event-Pace Session", type: "endurance", slots: [cardio("Event-pace work", "run", 1, [25, 40], "comfortably hard -- goal-event pace segments", "The week's ~20% hard dose, at event-specific intensity")] },
        { name: "Long Session", type: "endurance", slots: [cardio("Long easy effort", "run", 1, [60, 90], "easy -- builds toward event distance")] },
      ],
    },
    advanced: {
      days: [4, 6],
      sessions: [
        { name: "Easy Session", type: "endurance", slots: [cardio("Easy aerobic", "run", 1, [35, 50], "easy -- fully conversational")] },
        { name: "Easy Session 2", type: "endurance", slots: [cardio("Easy aerobic", "run", 1, [35, 50], "easy -- fully conversational")] },
        { name: "Event-Pace Session", type: "endurance", slots: [cardio("Event-pace work", "run", 1, [30, 50], "comfortably hard -- goal-event pace segments")] },
        { name: "Interval Session", type: "endurance", slots: [cardio("Interval repeats", "run", 1, [30, 45], "hard repeats with easy recoveries")] },
        { name: "Long Session", type: "endurance", slots: [cardio("Long easy effort", "run", 1, [75, 110], "easy -- builds toward event distance")] },
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
  bands: ["30", "45", "60_plus"],
  contextSwap: {
    home_basic_equipment: { run: "bike" },
  },
};
