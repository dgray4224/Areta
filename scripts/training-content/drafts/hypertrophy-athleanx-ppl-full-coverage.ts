import type { ContentBatch } from "@/domains/trainingprogram/content-spec";

/**
 * Full-coverage replacement for hypertrophy's 3 deactivated programs (see
 * migration 0053) -- same fix pattern as 0049 (hybrid_athlete) and
 * powerlifter-conjugate-full-coverage. ATHLEAN-X (Jeff Cavaliere) is
 * already allowlisted specifically for hypertrophy -- reused per
 * docs/training-content-pipeline.md's own example rather than researching
 * a new specialist, since it's already the best-matched entry. Grounded
 * in ATHLEAN-X's actual published Push/Pull/Legs guide, which runs each
 * of the 3 days twice a week with 6-7 exercises per day (heavy compound +
 * secondary compound + isolation + a superset pair) -- directly
 * motivating this program's 5-exercises-per-session structure, well
 * above the previous 1-3.
 */
export const batch: ContentBatch = {
  newExercises: [],
  programs: [
    {
      archetype: "hypertrophy",
      slug: "hypertrophy-athleanx-ppl-full-coverage",
      name: "ATHLEAN-X Push/Pull/Legs: Full Coverage",
      description:
        "Jeff Cavaliere's (ATHLEAN-X) Push/Pull/Legs split, run twice through per week (6 sessions) -- each day pairs one heavy compound lift with secondary compound and isolation work, matching ATHLEAN-X's real published PPL guide rather than a single main lift per day.",
      methodologyNote:
        "ATHLEAN-X's Push/Pull/Legs guide runs each focus twice weekly (a 'Workout One' and 'Workout Two' variant per day) with 6-7 exercises per session: a heavy compound lift, a secondary compound variation, isolation work for the target muscles, and a superset pair or corrective movement -- this program follows that same per-session shape.",
      experienceLevel: "intermediate",
      sessionsPerWeekMin: 5,
      sessionsPerWeekMax: 6,
      equipmentRequired: ["Barbell", "Dumbbells", "Full gym access"],
      displayOrder: 4,
      phases: [
        {
          name: "Foundation",
          focus: "Learn the twice-weekly Push/Pull/Legs rhythm at moderate effort with full exercise coverage per session.",
          lengthWeeks: 4,
          intensityStyle: "RPE 6-7",
          isFinal: false,
          sessions: [
            {
              name: "Push A",
              sessionType: "strength",
              exercises: [
                { kind: "strength", exerciseRef: "Barbell bench press", sets: 4, repsMin: 6, repsMax: 8, intensityType: "rpe", intensityValue: "7", coachingNotes: "Heavy compound press -- the day's main lift." },
                { kind: "strength", exerciseRef: "Incline dumbbell bench press", sets: 3, repsMin: 8, repsMax: 10, intensityType: "rpe", intensityValue: "7", coachingNotes: "Upper-chest emphasis, second pressing movement." },
                { kind: "strength", exerciseRef: "Dumbbell shoulder press", sets: 3, repsMin: 8, repsMax: 10, intensityType: "rpe", intensityValue: "7", coachingNotes: "Shoulder-focused pressing volume." },
                { kind: "strength", exerciseRef: "Dumbbell lateral raise", sets: 3, repsMin: 12, repsMax: 15, intensityType: "rpe", intensityValue: "6", coachingNotes: "Shoulder isolation for width." },
                { kind: "strength", exerciseRef: "Triceps pushdown", sets: 3, repsMin: 10, repsMax: 12, intensityType: "rpe", intensityValue: "6-7", coachingNotes: "Triceps isolation to close the session." },
              ],
            },
            {
              name: "Pull A",
              sessionType: "strength",
              exercises: [
                { kind: "strength", exerciseRef: "Barbell deadlift", sets: 3, repsMin: 5, repsMax: 6, intensityType: "rpe", intensityValue: "7", coachingNotes: "Heavy compound pull -- kept moderate volume since this is a hypertrophy day, not a max-effort day." },
                { kind: "strength", exerciseRef: "Barbell row", sets: 4, repsMin: 8, repsMax: 10, intensityType: "rpe", intensityValue: "7", coachingNotes: "Upper-back thickness work." },
                { kind: "strength", exerciseRef: "Lat pulldown", sets: 3, repsMin: 10, repsMax: 12, intensityType: "rpe", intensityValue: "7", coachingNotes: "Lat-width emphasis." },
                { kind: "strength", exerciseRef: "Face pull", sets: 3, repsMin: 15, repsMax: 20, intensityType: "rpe", intensityValue: "6", coachingNotes: "Rear delt/shoulder-health corrective work." },
                { kind: "strength", exerciseRef: "Barbell curl", sets: 3, repsMin: 8, repsMax: 10, intensityType: "rpe", intensityValue: "6-7", coachingNotes: "Biceps volume." },
              ],
            },
            {
              name: "Legs A",
              sessionType: "strength",
              exercises: [
                { kind: "strength", exerciseRef: "Barbell back squat", sets: 4, repsMin: 6, repsMax: 8, intensityType: "rpe", intensityValue: "7", coachingNotes: "Heavy compound -- the day's main lift." },
                { kind: "strength", exerciseRef: "Barbell hip thrust", sets: 3, repsMin: 8, repsMax: 10, intensityType: "rpe", intensityValue: "7", coachingNotes: "Glute-focused hip extension." },
                { kind: "strength", exerciseRef: "Bulgarian split squat", sets: 3, repsMin: 10, repsMax: 12, intensityType: "rpe", intensityValue: "7", coachingNotes: "Per leg -- unilateral quad/glute work." },
                { kind: "strength", exerciseRef: "Dumbbell Romanian deadlift", sets: 3, repsMin: 10, repsMax: 12, intensityType: "rpe", intensityValue: "6-7", coachingNotes: "Hamstring emphasis." },
                { kind: "strength", exerciseRef: "Standing calf raise", sets: 3, repsMin: 15, repsMax: 20, intensityType: "rpe", intensityValue: "6", coachingNotes: "Calf volume to close the session." },
              ],
            },
            {
              name: "Push B",
              sessionType: "strength",
              exercises: [
                { kind: "strength", exerciseRef: "Barbell overhead press", sets: 4, repsMin: 6, repsMax: 8, intensityType: "rpe", intensityValue: "7", coachingNotes: "Second weekly press exposure, shoulder-led this time." },
                { kind: "strength", exerciseRef: "Dumbbell bench press", sets: 3, repsMin: 8, repsMax: 10, intensityType: "rpe", intensityValue: "7", coachingNotes: "Chest variant with a longer stretch than the barbell version." },
                { kind: "strength", exerciseRef: "Cable fly", sets: 3, repsMin: 10, repsMax: 12, intensityType: "rpe", intensityValue: "6-7", coachingNotes: "Chest isolation, full stretch and squeeze." },
                { kind: "strength", exerciseRef: "Close-grip bench press", sets: 3, repsMin: 6, repsMax: 8, intensityType: "rpe", intensityValue: "7", coachingNotes: "Triceps-biased compound press." },
                { kind: "strength", exerciseRef: "Push-up", sets: 3, repsMin: 12, repsMax: 20, intensityType: "rpe", intensityValue: "7", coachingNotes: "Bodyweight finisher, taken close to failure." },
              ],
            },
            {
              name: "Pull B",
              sessionType: "strength",
              exercises: [
                { kind: "strength", exerciseRef: "Chin-up", sets: 4, repsMin: 6, repsMax: 8, intensityType: "rpe", intensityValue: "7", coachingNotes: "Second weekly heavy pull, vertical this time. Use an assisted variation if a clean set of 6 isn't there yet." },
                { kind: "strength", exerciseRef: "Dumbbell row", sets: 3, repsMin: 10, repsMax: 12, intensityType: "rpe", intensityValue: "7", coachingNotes: "Per arm -- unilateral back work." },
                { kind: "strength", exerciseRef: "Cable row", sets: 3, repsMin: 10, repsMax: 12, intensityType: "rpe", intensityValue: "6-7", coachingNotes: "Additional back-thickness volume." },
                { kind: "strength", exerciseRef: "Hammer curl", sets: 3, repsMin: 10, repsMax: 12, intensityType: "rpe", intensityValue: "6-7", coachingNotes: "Biceps/forearm volume, neutral grip." },
                { kind: "strength", exerciseRef: "Triceps pushdown", sets: 3, repsMin: 10, repsMax: 12, intensityType: "rpe", intensityValue: "6", coachingNotes: "Antagonist superset pairing, per ATHLEAN-X's own pull-day structure." },
              ],
            },
            {
              name: "Legs B",
              sessionType: "strength",
              exercises: [
                { kind: "strength", exerciseRef: "Front squat", sets: 4, repsMin: 6, repsMax: 8, intensityType: "rpe", intensityValue: "7", coachingNotes: "Second weekly leg day, quad-biased variation." },
                { kind: "strength", exerciseRef: "Single-leg Romanian deadlift", sets: 3, repsMin: 10, repsMax: 12, intensityType: "rpe", intensityValue: "7", coachingNotes: "Per leg -- unilateral hamstring/balance work." },
                { kind: "strength", exerciseRef: "Reverse lunge", sets: 3, repsMin: 10, repsMax: 12, intensityType: "rpe", intensityValue: "7", coachingNotes: "Per leg." },
                { kind: "strength", exerciseRef: "Leg extension", sets: 3, repsMin: 12, repsMax: 15, intensityType: "rpe", intensityValue: "6-7", coachingNotes: "Quad isolation finisher." },
                { kind: "strength", exerciseRef: "Seated calf raise", sets: 3, repsMin: 15, repsMax: 20, intensityType: "rpe", intensityValue: "6", coachingNotes: "Bent-knee calf variant for soleus emphasis." },
              ],
            },
          ],
        },
        {
          name: "Progression",
          focus: "Heavier loading across all six sessions with the same full-coverage structure.",
          lengthWeeks: 5,
          intensityStyle: "RPE 7-9",
          isFinal: true,
          sessions: [
            {
              name: "Push A",
              sessionType: "strength",
              exercises: [
                { kind: "strength", exerciseRef: "Barbell bench press", sets: 4, repsMin: 5, repsMax: 6, intensityType: "rpe", intensityValue: "8", coachingNotes: "Heavier than Foundation." },
                { kind: "strength", exerciseRef: "Incline dumbbell bench press", sets: 3, repsMin: 6, repsMax: 8, intensityType: "rpe", intensityValue: "8", coachingNotes: "Heavier than Foundation." },
                { kind: "strength", exerciseRef: "Dumbbell shoulder press", sets: 3, repsMin: 6, repsMax: 8, intensityType: "rpe", intensityValue: "8", coachingNotes: "Heavier than Foundation." },
                { kind: "strength", exerciseRef: "Dumbbell lateral raise", sets: 4, repsMin: 12, repsMax: 15, intensityType: "rpe", intensityValue: "7", coachingNotes: "Added a set from Foundation." },
                { kind: "strength", exerciseRef: "Triceps pushdown", sets: 3, repsMin: 8, repsMax: 10, intensityType: "rpe", intensityValue: "7-8", coachingNotes: "Heavier than Foundation." },
              ],
            },
            {
              name: "Pull A",
              sessionType: "strength",
              exercises: [
                { kind: "strength", exerciseRef: "Barbell deadlift", sets: 3, repsMin: 4, repsMax: 5, intensityType: "rpe", intensityValue: "8", coachingNotes: "Heavier than Foundation." },
                { kind: "strength", exerciseRef: "Barbell row", sets: 4, repsMin: 6, repsMax: 8, intensityType: "rpe", intensityValue: "8", coachingNotes: "Heavier than Foundation." },
                { kind: "strength", exerciseRef: "Lat pulldown", sets: 3, repsMin: 8, repsMax: 10, intensityType: "rpe", intensityValue: "8", coachingNotes: "Heavier than Foundation." },
                { kind: "strength", exerciseRef: "Face pull", sets: 3, repsMin: 15, repsMax: 20, intensityType: "rpe", intensityValue: "7", coachingNotes: "Kept high-rep by design -- shoulder-health work stays submaximal." },
                { kind: "strength", exerciseRef: "Barbell curl", sets: 3, repsMin: 6, repsMax: 8, intensityType: "rpe", intensityValue: "7-8", coachingNotes: "Heavier than Foundation." },
              ],
            },
            {
              name: "Legs A",
              sessionType: "strength",
              exercises: [
                { kind: "strength", exerciseRef: "Barbell back squat", sets: 4, repsMin: 5, repsMax: 6, intensityType: "rpe", intensityValue: "8", coachingNotes: "Heavier than Foundation." },
                { kind: "strength", exerciseRef: "Barbell hip thrust", sets: 3, repsMin: 6, repsMax: 8, intensityType: "rpe", intensityValue: "8", coachingNotes: "Heavier than Foundation." },
                { kind: "strength", exerciseRef: "Bulgarian split squat", sets: 3, repsMin: 8, repsMax: 10, intensityType: "rpe", intensityValue: "8", coachingNotes: "Heavier per-leg loading than Foundation." },
                { kind: "strength", exerciseRef: "Dumbbell Romanian deadlift", sets: 3, repsMin: 8, repsMax: 10, intensityType: "rpe", intensityValue: "7-8", coachingNotes: "Heavier than Foundation." },
                { kind: "strength", exerciseRef: "Standing calf raise", sets: 4, repsMin: 15, repsMax: 20, intensityType: "rpe", intensityValue: "7", coachingNotes: "Added a set from Foundation." },
              ],
            },
            {
              name: "Push B",
              sessionType: "strength",
              exercises: [
                { kind: "strength", exerciseRef: "Barbell overhead press", sets: 4, repsMin: 5, repsMax: 6, intensityType: "rpe", intensityValue: "8", coachingNotes: "Heavier than Foundation." },
                { kind: "strength", exerciseRef: "Dumbbell bench press", sets: 3, repsMin: 6, repsMax: 8, intensityType: "rpe", intensityValue: "8", coachingNotes: "Heavier than Foundation." },
                { kind: "strength", exerciseRef: "Cable fly", sets: 3, repsMin: 8, repsMax: 10, intensityType: "rpe", intensityValue: "7-8", coachingNotes: "Heavier than Foundation." },
                { kind: "strength", exerciseRef: "Close-grip bench press", sets: 3, repsMin: 5, repsMax: 6, intensityType: "rpe", intensityValue: "8", coachingNotes: "Heavier than Foundation." },
                { kind: "strength", exerciseRef: "Push-up", sets: 4, repsMin: 15, repsMax: 25, intensityType: "rpe", intensityValue: "8", coachingNotes: "Added a set from Foundation." },
              ],
            },
            {
              name: "Pull B",
              sessionType: "strength",
              exercises: [
                { kind: "strength", exerciseRef: "Chin-up", sets: 4, repsMin: 5, repsMax: 6, intensityType: "rpe", intensityValue: "8", coachingNotes: "Add weight if bodyweight reps are no longer challenging in this range." },
                { kind: "strength", exerciseRef: "Dumbbell row", sets: 3, repsMin: 8, repsMax: 10, intensityType: "rpe", intensityValue: "8", coachingNotes: "Heavier than Foundation." },
                { kind: "strength", exerciseRef: "Cable row", sets: 3, repsMin: 8, repsMax: 10, intensityType: "rpe", intensityValue: "7-8", coachingNotes: "Heavier than Foundation." },
                { kind: "strength", exerciseRef: "Hammer curl", sets: 3, repsMin: 8, repsMax: 10, intensityType: "rpe", intensityValue: "7-8", coachingNotes: "Heavier than Foundation." },
                { kind: "strength", exerciseRef: "Triceps pushdown", sets: 3, repsMin: 8, repsMax: 10, intensityType: "rpe", intensityValue: "7", coachingNotes: "Heavier than Foundation." },
              ],
            },
            {
              name: "Legs B",
              sessionType: "strength",
              exercises: [
                { kind: "strength", exerciseRef: "Front squat", sets: 4, repsMin: 5, repsMax: 6, intensityType: "rpe", intensityValue: "8", coachingNotes: "Heavier than Foundation." },
                { kind: "strength", exerciseRef: "Single-leg Romanian deadlift", sets: 3, repsMin: 8, repsMax: 10, intensityType: "rpe", intensityValue: "8", coachingNotes: "Heavier than Foundation." },
                { kind: "strength", exerciseRef: "Reverse lunge", sets: 3, repsMin: 8, repsMax: 10, intensityType: "rpe", intensityValue: "8", coachingNotes: "Heavier than Foundation." },
                { kind: "strength", exerciseRef: "Leg extension", sets: 3, repsMin: 10, repsMax: 12, intensityType: "rpe", intensityValue: "7-8", coachingNotes: "Heavier than Foundation." },
                { kind: "strength", exerciseRef: "Seated calf raise", sets: 4, repsMin: 15, repsMax: 20, intensityType: "rpe", intensityValue: "7", coachingNotes: "Added a set from Foundation." },
              ],
            },
          ],
        },
      ],
      sources: [
        {
          organization: "Jeff Cavaliere / ATHLEAN-X",
          title: "Push Pull Legs Routine | PPL Split for Max Gains - ATHLEAN-X",
          url: "https://learn.athleanx.com/articles/push-pull-legs-routine-the-complete-guide",
          retrievedAt: "2026-08-05",
        },
      ],
    },
  ],
};
