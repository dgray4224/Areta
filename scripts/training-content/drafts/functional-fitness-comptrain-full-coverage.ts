import type { ContentBatch } from "@/domains/trainingprogram/content-spec";

/**
 * Full-coverage replacement for functional_fitness's 3 deactivated
 * programs (see migration 0053) -- those had 1-2 exercises per strength
 * session throughout, and even their "conditioning" days were single-
 * movement rather than the multi-movement chippers/couplets that
 * actually define the sport. Grounded in Ben Bergeron/CompTrain -- coach
 * of 6 CrossFit Games/World Champions -- whose own site (comptrain.com)
 * describes its programming as combining strength, conditioning, and
 * mobility into one unified system rather than training them in
 * isolation, which is exactly what this program's full-coverage sessions
 * do (each strength-type day pairs a main lift/skill with real supporting
 * work, and the Conditioning day is a genuine 5-movement chipper rather
 * than a single exercise).
 */
export const batch: ContentBatch = {
  newExercises: [],
  programs: [
    {
      archetype: "functional_fitness",
      slug: "functional-fitness-comptrain-full-coverage",
      name: "CompTrain Strength/Skills/Conditioning: Full Coverage",
      description:
        "A 4-day functional fitness split -- Strength, Gymnastics Skills, Olympic Lifting, and a genuine multi-movement Conditioning chipper -- each strength-type day with real supporting exercises instead of just 1-2 movements, and Conditioning built as an actual chipper (5 movements) instead of a single exercise.",
      methodologyNote:
        "Ben Bergeron / CompTrain -- coach of 6 CrossFit Games/World Champions -- programs by combining strength, conditioning, and mobility into one unified system (per comptrain.com) rather than training any one in isolation. Applied here as 3 distinct strength-type days (barbell strength, gymnastics skill work, Olympic lifting) each with real supporting exercises, plus a Conditioning day built as an actual multi-movement chipper -- the format that actually defines competitive functional fitness -- rather than a single exercise standing in for the whole session.",
      experienceLevel: "intermediate",
      sessionsPerWeekMin: 4,
      sessionsPerWeekMax: 4,
      equipmentRequired: ["Barbell", "Dumbbells", "Kettlebells", "Pull-up bar", "Full gym access"],
      displayOrder: 4,
      phases: [
        {
          name: "Foundation",
          focus: "Build strength, gymnastics skill capacity, and Olympic lift technique, and introduce real multi-movement conditioning.",
          lengthWeeks: 4,
          intensityStyle: "RPE 6-7",
          isFinal: false,
          sessions: [
            {
              name: "Strength Day",
              sessionType: "strength",
              exercises: [
                { kind: "strength", exerciseRef: "Barbell back squat", sets: 4, repsMin: 5, repsMax: 5, intensityType: "rpe", intensityValue: "7", coachingNotes: "Main lower-body strength work for the week." },
                { kind: "strength", exerciseRef: "Barbell deadlift", sets: 3, repsMin: 5, repsMax: 5, intensityType: "rpe", intensityValue: "7", coachingNotes: "Posterior-chain strength." },
                { kind: "strength", exerciseRef: "Barbell bench press", sets: 4, repsMin: 6, repsMax: 6, intensityType: "rpe", intensityValue: "7", coachingNotes: "Main upper-body pressing work." },
                { kind: "strength", exerciseRef: "Barbell overhead press", sets: 3, repsMin: 6, repsMax: 6, intensityType: "rpe", intensityValue: "7", coachingNotes: "Overhead pressing strength, supports jerks and handstand work." },
                { kind: "strength", exerciseRef: "Plank", sets: 3, repsMin: 1, repsMax: 1, intensityType: "none", coachingNotes: "30-45 second holds -- core bracing for all the barbell work above." },
              ],
            },
            {
              name: "Gymnastics Skill Day",
              sessionType: "strength",
              exercises: [
                { kind: "strength", exerciseRef: "Pull-up", sets: 4, repsMin: 6, repsMax: 8, intensityType: "rpe", intensityValue: "7", coachingNotes: "Strict pulling strength -- the foundation for kipping/butterfly work later." },
                { kind: "strength", exerciseRef: "Handstand push-up", sets: 4, repsMin: 5, repsMax: 8, intensityType: "rpe", intensityValue: "7", coachingNotes: "Scale to a box or pike variation if strict reps aren't there yet." },
                { kind: "strength", exerciseRef: "Toes-to-bar", sets: 4, repsMin: 8, repsMax: 10, intensityType: "rpe", intensityValue: "7", coachingNotes: "Core/grip gymnastics skill work." },
                { kind: "strength", exerciseRef: "Muscle-up", sets: 3, repsMin: 3, repsMax: 5, intensityType: "rpe", intensityValue: "7", coachingNotes: "Scale to banded or jumping muscle-ups if unbroken reps aren't there yet." },
                { kind: "strength", exerciseRef: "Rope climb", sets: 3, repsMin: 2, repsMax: 3, intensityType: "rpe", intensityValue: "7", coachingNotes: "Grip/pulling conditioning to close the session." },
              ],
            },
            {
              name: "Olympic Lift Day",
              sessionType: "strength",
              exercises: [
                { kind: "strength", exerciseRef: "Power clean", sets: 5, repsMin: 3, repsMax: 3, intensityType: "rpe", intensityValue: "7", coachingNotes: "Main Olympic-lift work for the week." },
                { kind: "strength", exerciseRef: "Push press", sets: 4, repsMin: 3, repsMax: 3, intensityType: "rpe", intensityValue: "7", coachingNotes: "Overhead strength/speed, supports the jerk." },
                { kind: "strength", exerciseRef: "Front squat", sets: 3, repsMin: 5, repsMax: 5, intensityType: "rpe", intensityValue: "7", coachingNotes: "Front-rack strength for the clean's receiving position." },
                { kind: "strength", exerciseRef: "Power snatch", sets: 4, repsMin: 3, repsMax: 3, intensityType: "rpe", intensityValue: "7", coachingNotes: "Second classic lift of the day." },
                { kind: "strength", exerciseRef: "Box jump", sets: 3, repsMin: 5, repsMax: 5, intensityType: "rpe", intensityValue: "7", coachingNotes: "Lower-body power work to close the session." },
              ],
            },
            {
              name: "Conditioning",
              sessionType: "conditioning",
              exercises: [
                { kind: "strength", exerciseRef: "Wall ball shot", sets: 1, repsMin: 50, repsMax: 50, intensityType: "rpe", intensityValue: "9", coachingNotes: "For time chipper: 50 wall ball shots, 40 kettlebell swings, 30 box jumps, 20 devil press, 10 burpees -- pace to finish strong, not just survive the first movement." },
                { kind: "strength", exerciseRef: "Kettlebell swing", sets: 1, repsMin: 40, repsMax: 40, intensityType: "rpe", intensityValue: "9", coachingNotes: "Second movement of the chipper -- see wall ball shot for the full workout." },
                { kind: "strength", exerciseRef: "Box jump", sets: 1, repsMin: 30, repsMax: 30, intensityType: "rpe", intensityValue: "9", coachingNotes: "Third movement of the chipper." },
                { kind: "strength", exerciseRef: "Devil press", sets: 1, repsMin: 20, repsMax: 20, intensityType: "rpe", intensityValue: "9", coachingNotes: "Fourth movement of the chipper -- the grinder." },
                { kind: "strength", exerciseRef: "Burpee", sets: 1, repsMin: 10, repsMax: 10, intensityType: "rpe", intensityValue: "9", coachingNotes: "Final movement of the chipper -- empty the tank." },
              ],
            },
          ],
        },
        {
          name: "Peak",
          focus: "Heavier strength and Olympic lift loading, harder gymnastics volume, and a longer conditioning chipper.",
          lengthWeeks: 5,
          intensityStyle: "RPE 8-9",
          isFinal: true,
          sessions: [
            {
              name: "Strength Day",
              sessionType: "strength",
              exercises: [
                { kind: "strength", exerciseRef: "Barbell back squat", sets: 4, repsMin: 4, repsMax: 4, intensityType: "rpe", intensityValue: "8", coachingNotes: "Heavier than Foundation." },
                { kind: "strength", exerciseRef: "Barbell deadlift", sets: 3, repsMin: 4, repsMax: 4, intensityType: "rpe", intensityValue: "8", coachingNotes: "Heavier than Foundation." },
                { kind: "strength", exerciseRef: "Barbell bench press", sets: 4, repsMin: 5, repsMax: 5, intensityType: "rpe", intensityValue: "8", coachingNotes: "Heavier than Foundation." },
                { kind: "strength", exerciseRef: "Barbell overhead press", sets: 3, repsMin: 5, repsMax: 5, intensityType: "rpe", intensityValue: "8", coachingNotes: "Heavier than Foundation." },
                { kind: "strength", exerciseRef: "Plank", sets: 3, repsMin: 1, repsMax: 1, intensityType: "none", coachingNotes: "45-60 second holds." },
              ],
            },
            {
              name: "Gymnastics Skill Day",
              sessionType: "strength",
              exercises: [
                { kind: "strength", exerciseRef: "Pull-up", sets: 4, repsMin: 8, repsMax: 10, intensityType: "rpe", intensityValue: "8", coachingNotes: "Add weight if bodyweight reps are no longer challenging in this range." },
                { kind: "strength", exerciseRef: "Handstand push-up", sets: 4, repsMin: 8, repsMax: 10, intensityType: "rpe", intensityValue: "8", coachingNotes: "More reps than Foundation." },
                { kind: "strength", exerciseRef: "Toes-to-bar", sets: 4, repsMin: 10, repsMax: 12, intensityType: "rpe", intensityValue: "8", coachingNotes: "More reps than Foundation." },
                { kind: "strength", exerciseRef: "Muscle-up", sets: 4, repsMin: 4, repsMax: 6, intensityType: "rpe", intensityValue: "8", coachingNotes: "Added a set from Foundation." },
                { kind: "strength", exerciseRef: "Rope climb", sets: 4, repsMin: 2, repsMax: 3, intensityType: "rpe", intensityValue: "8", coachingNotes: "Added a set from Foundation." },
              ],
            },
            {
              name: "Olympic Lift Day",
              sessionType: "strength",
              exercises: [
                { kind: "strength", exerciseRef: "Power clean", sets: 5, repsMin: 2, repsMax: 2, intensityType: "rpe", intensityValue: "8", coachingNotes: "Heavier than Foundation." },
                { kind: "strength", exerciseRef: "Push press", sets: 4, repsMin: 2, repsMax: 2, intensityType: "rpe", intensityValue: "8", coachingNotes: "Heavier than Foundation." },
                { kind: "strength", exerciseRef: "Front squat", sets: 3, repsMin: 4, repsMax: 4, intensityType: "rpe", intensityValue: "8", coachingNotes: "Heavier than Foundation." },
                { kind: "strength", exerciseRef: "Power snatch", sets: 4, repsMin: 2, repsMax: 2, intensityType: "rpe", intensityValue: "8", coachingNotes: "Heavier than Foundation." },
                { kind: "strength", exerciseRef: "Box jump", sets: 4, repsMin: 5, repsMax: 5, intensityType: "rpe", intensityValue: "8", coachingNotes: "Added a set from Foundation." },
              ],
            },
            {
              name: "Conditioning",
              sessionType: "conditioning",
              exercises: [
                { kind: "strength", exerciseRef: "Wall ball shot", sets: 1, repsMin: 60, repsMax: 60, intensityType: "rpe", intensityValue: "9", coachingNotes: "Longer for-time chipper than Foundation: 60 wall ball shots, 50 kettlebell swings, 40 box jumps, 30 devil press, 20 burpees." },
                { kind: "strength", exerciseRef: "Kettlebell swing", sets: 1, repsMin: 50, repsMax: 50, intensityType: "rpe", intensityValue: "9", coachingNotes: "Second movement of the chipper -- see wall ball shot for the full workout." },
                { kind: "strength", exerciseRef: "Box jump", sets: 1, repsMin: 40, repsMax: 40, intensityType: "rpe", intensityValue: "9", coachingNotes: "Third movement of the chipper." },
                { kind: "strength", exerciseRef: "Devil press", sets: 1, repsMin: 30, repsMax: 30, intensityType: "rpe", intensityValue: "9", coachingNotes: "Fourth movement of the chipper -- the grinder." },
                { kind: "strength", exerciseRef: "Burpee", sets: 1, repsMin: 20, repsMax: 20, intensityType: "rpe", intensityValue: "9", coachingNotes: "Final movement of the chipper -- empty the tank." },
              ],
            },
          ],
        },
      ],
      sources: [
        {
          organization: "Ben Bergeron / CompTrain",
          title: "CompTrain -- Become Formidable",
          url: "https://www.comptrain.com/",
          retrievedAt: "2026-08-05",
        },
      ],
    },
  ],
};
