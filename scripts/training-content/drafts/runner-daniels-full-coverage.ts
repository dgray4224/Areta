import type { ContentBatch } from "@/domains/trainingprogram/content-spec";

/**
 * Full-coverage replacement for long_distance_runner's 3 deactivated
 * programs (see migration 0053) -- their "Strength Support" days had only
 * 1-3 accessory exercises. Note this is a narrower fix than powerlifter/
 * hypertrophy's: the running sessions themselves stay single-modality
 * (one continuous or interval-structured run per session, same as any
 * cardio-type session elsewhere in this system) -- the >=4-exercise bar
 * applies to the program's one strength-type session, per the explicit
 * decision that endurance archetypes get no exception there. Grounded in
 * Jack Daniels' (Daniels' Running Formula / VDOT) five-pace framework for
 * the running sessions themselves.
 */
export const batch: ContentBatch = {
  newExercises: [
    {
      refKey: "trackIntervalRepeats",
      name: "Track interval repeats",
      movementPattern: "aerobic / conditioning",
      equipmentRequired: ["Bodyweight only"],
      archetypeTags: ["long_distance_runner"],
      difficulty: "intermediate",
      primaryMuscleGroups: ["legs", "cardio"],
      instructions:
        "Hard, sustained repeats at interval pace (roughly 97-100% VO2max, 3-5 minutes each) with an easy jog recovery between reps -- stresses aerobic power without excessive lactate buildup.",
    },
    {
      refKey: "trackSpeedRepetitions",
      name: "Track speed repetitions",
      movementPattern: "anaerobic / speed",
      equipmentRequired: ["Bodyweight only"],
      archetypeTags: ["long_distance_runner"],
      difficulty: "intermediate",
      primaryMuscleGroups: ["legs", "cardio"],
      instructions:
        "Short, fast repeats at repetition pace with long recoveries between reps, so each one feels controlled rather than exhausting -- builds running economy and speed without accumulating fatigue.",
    },
  ],
  programs: [
    {
      archetype: "long_distance_runner",
      slug: "runner-daniels-five-pace-full-coverage",
      name: "Daniels' Five-Pace Formula: Full Coverage",
      description:
        "Jack Daniels' (Daniels' Running Formula, VDOT) five-training-pace framework -- Easy, Threshold, Interval, and Repetition runs across the week, each mapped to a specific physiological target -- paired with a real multi-exercise strength support day instead of just 1-2 accessory lifts.",
      methodologyNote:
        "Jack Daniels' VDOT system prescribes training paces by physiological target: Easy (59-74% VO2max) builds aerobic base; Threshold (83-88% VO2max, sustained 5-15 minute efforts) improves lactate clearance; Interval (97-100% VO2max, 3-5 minute efforts) maximizes aerobic power; Repetition pace (short, fast, long recoveries) builds speed and running economy without accumulating fatigue. The strength support day is not part of Daniels' own published system -- built separately per this app's own >=4-exercise-per-strength-session standard, using running-relevant injury-prevention and hip/hamstring/core work.",
      experienceLevel: "intermediate",
      sessionsPerWeekMin: 5,
      sessionsPerWeekMax: 5,
      equipmentRequired: ["Barbell", "Dumbbells", "Full gym access", "Bodyweight only"],
      displayOrder: 1,
      phases: [
        {
          name: "Base Building",
          focus: "Build aerobic base with easy mileage, introduce threshold and interval work, and support the added volume with real strength work.",
          lengthWeeks: 4,
          intensityStyle: "Easy effort throughout except threshold/interval days",
          isFinal: false,
          sessions: [
            {
              name: "Easy Run",
              sessionType: "conditioning",
              exercises: [
                {
                  kind: "cardio",
                  exerciseRef: "Easy-pace run",
                  durationMinutes: 30,
                  cardioIntensity: "conversational, easy effort (59-74% VO2max) -- builds the aerobic base everything else depends on.",
                },
              ],
            },
            {
              name: "Long Run",
              sessionType: "conditioning",
              exercises: [
                {
                  kind: "cardio",
                  exerciseRef: "Easy-pace run",
                  durationMinutes: 60,
                  cardioIntensity: "conversational, easy effort -- the week's longest continuous run.",
                },
              ],
            },
            {
              name: "Threshold Run",
              sessionType: "conditioning",
              exercises: [
                {
                  kind: "cardio",
                  exerciseRef: "Tempo run",
                  sets: 3,
                  durationMinutes: 10,
                  cardioIntensity: "3 x 10 min at threshold pace (83-88% VO2max), 2 min easy jog recovery.",
                },
              ],
            },
            {
              name: "Interval Day",
              sessionType: "conditioning",
              exercises: [
                {
                  kind: "cardio",
                  exerciseRef: "trackIntervalRepeats",
                  sets: 5,
                  durationMinutes: 4,
                  cardioIntensity: "5 x 4 min at interval pace (97-100% VO2max), 3 min easy jog recovery.",
                },
              ],
            },
            {
              name: "Strength Support",
              sessionType: "strength",
              exercises: [
                { kind: "strength", exerciseRef: "Single-leg Romanian deadlift", sets: 3, repsMin: 8, repsMax: 10, intensityType: "rpe", intensityValue: "6", coachingNotes: "Per leg -- balance and hamstring resilience for the added mileage." },
                { kind: "strength", exerciseRef: "Nordic curl", sets: 3, repsMin: 6, repsMax: 8, intensityType: "rpe", intensityValue: "6", coachingNotes: "Eccentric hamstring strength -- well-supported injury-prevention work for runners." },
                { kind: "strength", exerciseRef: "Barbell hip thrust", sets: 3, repsMin: 10, repsMax: 12, intensityType: "rpe", intensityValue: "6", coachingNotes: "Glute strength to support hip drive." },
                { kind: "strength", exerciseRef: "Plank", sets: 3, repsMin: 1, repsMax: 1, intensityType: "none", coachingNotes: "30-45 second holds -- core stability for running posture." },
                { kind: "strength", exerciseRef: "Standing calf raise", sets: 3, repsMin: 12, repsMax: 15, intensityType: "rpe", intensityValue: "6", coachingNotes: "Calf/Achilles resilience for the mileage load." },
              ],
            },
          ],
        },
        {
          name: "Quality Development",
          focus: "Extend the long run, add threshold volume, and shift interval work to repetition-pace speed as the program peaks.",
          lengthWeeks: 5,
          intensityStyle: "Easy effort throughout except threshold/repetition days",
          isFinal: true,
          sessions: [
            {
              name: "Easy Run",
              sessionType: "conditioning",
              exercises: [
                {
                  kind: "cardio",
                  exerciseRef: "Easy-pace run",
                  durationMinutes: 35,
                  cardioIntensity: "conversational, easy effort -- kept easy even as other days intensify.",
                },
              ],
            },
            {
              name: "Long Run",
              sessionType: "conditioning",
              exercises: [
                {
                  kind: "cardio",
                  exerciseRef: "Easy-pace run",
                  durationMinutes: 75,
                  cardioIntensity: "conversational, easy effort -- the longest run of the program.",
                },
              ],
            },
            {
              name: "Threshold Run",
              sessionType: "conditioning",
              exercises: [
                {
                  kind: "cardio",
                  exerciseRef: "Tempo run",
                  sets: 4,
                  durationMinutes: 8,
                  cardioIntensity: "4 x 8 min at threshold pace, 90 sec easy jog recovery -- more total threshold volume than Base Building.",
                },
              ],
            },
            {
              name: "Repetition Day",
              sessionType: "conditioning",
              exercises: [
                {
                  kind: "cardio",
                  exerciseRef: "trackSpeedRepetitions",
                  sets: 8,
                  durationMinutes: 2,
                  cardioIntensity: "8 x 2 min at repetition pace with full recovery jogs between reps -- speed/economy work as the program peaks.",
                },
              ],
            },
            {
              name: "Strength Support",
              sessionType: "strength",
              exercises: [
                { kind: "strength", exerciseRef: "Single-leg Romanian deadlift", sets: 3, repsMin: 6, repsMax: 8, intensityType: "rpe", intensityValue: "7", coachingNotes: "Heavier than Base Building." },
                { kind: "strength", exerciseRef: "Nordic curl", sets: 3, repsMin: 8, repsMax: 10, intensityType: "rpe", intensityValue: "7", coachingNotes: "Added reps from Base Building." },
                { kind: "strength", exerciseRef: "Barbell hip thrust", sets: 3, repsMin: 8, repsMax: 10, intensityType: "rpe", intensityValue: "7", coachingNotes: "Heavier than Base Building." },
                { kind: "strength", exerciseRef: "Plank", sets: 3, repsMin: 1, repsMax: 1, intensityType: "none", coachingNotes: "45-60 second holds." },
                { kind: "strength", exerciseRef: "Standing calf raise", sets: 3, repsMin: 15, repsMax: 20, intensityType: "rpe", intensityValue: "7", coachingNotes: "Heavier than Base Building." },
              ],
            },
          ],
        },
      ],
      sources: [
        {
          organization: "Dr. Jack Daniels / V.O2",
          title: "V.O2 Running Calculator -- Jack Daniels' Five Training Paces",
          url: "https://vdoto2.com/calculator",
          retrievedAt: "2026-08-05",
        },
      ],
    },
  ],
};
