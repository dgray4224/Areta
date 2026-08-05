import type { ContentBatch } from "@/domains/trainingprogram/content-spec";

/**
 * Full-coverage replacement for cyclist's 3 deactivated programs (see
 * migration 0053) -- same narrower fix shape as the long_distance_runner
 * program: cycling sessions stay single-modality (one continuous or
 * interval-structured ride per session), the >=4-exercise bar applies to
 * the program's Strength Support session, per the explicit decision that
 * endurance archetypes get no exception there. Grounded in Andrew
 * Coggan's power-based training zone system (as documented by Hunter
 * Allen, Coggan's co-author on "Training and Racing with a Power Meter"),
 * the standard framework this app's existing cycling exercise library
 * (hill repeats, threshold intervals, endurance rides, sprints) already
 * maps onto directly.
 */
export const batch: ContentBatch = {
  newExercises: [],
  programs: [
    {
      archetype: "cyclist",
      slug: "cyclist-coggan-power-zones-full-coverage",
      name: "Coggan Power Zones: Full Coverage",
      description:
        "Andrew Coggan's 7-zone power-based training system (as % of FTP) -- Endurance, Tempo, Threshold, and VO2max/hill-repeat rides across the week -- paired with a real multi-exercise strength support day for pedaling asymmetry, core, and posterior-chain resilience instead of just 1-2 accessory lifts.",
      methodologyNote:
        "Andrew Coggan's power training zones (documented by Hunter Allen, his co-author on Training and Racing with a Power Meter) define seven zones as % of FTP: Endurance (56-75%) for long steady rides, Tempo (76-90%) for moderate sustained efforts, Threshold (91-105%, intervals at least 10 minutes long) for lactate-threshold work, and VO2max (106-120%, ~3-8 minute efforts) for aerobic power -- directly mapped here onto this app's existing cycling-specific cardio exercises. The strength support day is not part of Coggan's own system -- built separately per this app's own >=4-exercise-per-strength-session standard, using bike-relevant unilateral, core, and posterior-chain work.",
      experienceLevel: "intermediate",
      sessionsPerWeekMin: 5,
      sessionsPerWeekMax: 5,
      equipmentRequired: ["Cardio machine", "Full gym access", "Dumbbells", "Bodyweight only"],
      displayOrder: 1,
      phases: [
        {
          name: "Base Building",
          focus: "Build aerobic endurance, introduce tempo and threshold work, and support the added volume with real strength work.",
          lengthWeeks: 4,
          intensityStyle: "Zone 2 effort throughout except tempo/threshold days",
          isFinal: false,
          sessions: [
            {
              name: "Endurance Ride",
              sessionType: "conditioning",
              exercises: [
                {
                  kind: "cardio",
                  exerciseRef: "Long endurance ride",
                  durationMinutes: 90,
                  cardioIntensity: "Zone 2 Endurance (56-75% FTP), conversational effort -- the week's aerobic foundation.",
                },
              ],
            },
            {
              name: "Tempo Ride",
              sessionType: "conditioning",
              exercises: [
                {
                  kind: "cardio",
                  exerciseRef: "Stationary bike steady-state",
                  durationMinutes: 60,
                  cardioIntensity: "Zone 3 Tempo (76-90% FTP), sustained moderate effort.",
                },
              ],
            },
            {
              name: "Threshold Intervals",
              sessionType: "conditioning",
              exercises: [
                {
                  kind: "cardio",
                  exerciseRef: "Cycling threshold intervals",
                  sets: 3,
                  durationMinutes: 12,
                  cardioIntensity: "Zone 4 Threshold (91-105% FTP), 3 x 12 min, 5 min easy spin recovery -- per Coggan's guidance that threshold intervals need at least 10 minutes to trigger adaptation.",
                },
              ],
            },
            {
              name: "VO2max Hill Repeats",
              sessionType: "conditioning",
              exercises: [
                {
                  kind: "cardio",
                  exerciseRef: "Cycling hill repeats",
                  sets: 5,
                  durationMinutes: 4,
                  cardioIntensity: "Zone 5 VO2max (106-120% FTP), 5 x 4 min climbing effort, full recovery spin down between reps.",
                },
              ],
            },
            {
              name: "Strength Support",
              sessionType: "strength",
              exercises: [
                { kind: "strength", exerciseRef: "Bulgarian split squat", sets: 3, repsMin: 8, repsMax: 10, intensityType: "rpe", intensityValue: "6", coachingNotes: "Per leg -- addresses side-to-side power imbalances pedaling alone doesn't correct." },
                { kind: "strength", exerciseRef: "Single-leg Romanian deadlift", sets: 3, repsMin: 8, repsMax: 10, intensityType: "rpe", intensityValue: "6", coachingNotes: "Per leg -- posterior-chain and hip stability." },
                { kind: "strength", exerciseRef: "Plank", sets: 3, repsMin: 1, repsMax: 1, intensityType: "none", coachingNotes: "30-45 second holds -- core endurance for maintaining an aero position." },
                { kind: "strength", exerciseRef: "Side plank", sets: 3, repsMin: 1, repsMax: 1, intensityType: "none", coachingNotes: "20-30 second holds per side -- lateral hip stability, addresses hip drop on the bike." },
                { kind: "strength", exerciseRef: "Standing calf raise", sets: 3, repsMin: 15, repsMax: 20, intensityType: "rpe", intensityValue: "6", coachingNotes: "Lower-leg endurance work." },
              ],
            },
          ],
        },
        {
          name: "Build",
          focus: "More threshold and VO2max volume, plus anaerobic sprint work, alongside heavier strength support.",
          lengthWeeks: 5,
          intensityStyle: "Zone 2 effort throughout except tempo/threshold/VO2max days",
          isFinal: true,
          sessions: [
            {
              name: "Endurance Ride",
              sessionType: "conditioning",
              exercises: [
                {
                  kind: "cardio",
                  exerciseRef: "Long endurance ride",
                  durationMinutes: 120,
                  cardioIntensity: "Zone 2 Endurance -- longer than Base Building.",
                },
              ],
            },
            {
              name: "Tempo Ride",
              sessionType: "conditioning",
              exercises: [
                {
                  kind: "cardio",
                  exerciseRef: "Stationary bike steady-state",
                  durationMinutes: 75,
                  cardioIntensity: "Zone 3 Tempo -- longer than Base Building.",
                },
              ],
            },
            {
              name: "Threshold Intervals",
              sessionType: "conditioning",
              exercises: [
                {
                  kind: "cardio",
                  exerciseRef: "Cycling threshold intervals",
                  sets: 4,
                  durationMinutes: 12,
                  cardioIntensity: "Zone 4 Threshold, 4 x 12 min, 5 min easy spin recovery -- one more interval than Base Building.",
                },
              ],
            },
            {
              name: "Sprint & VO2max",
              sessionType: "conditioning",
              exercises: [
                {
                  kind: "cardio",
                  exerciseRef: "Standing bike sprints",
                  sets: 6,
                  durationMinutes: 1,
                  cardioIntensity: "Zone 6-7 Anaerobic/Neuromuscular, 6 x ~30 sec all-out standing sprints, full recovery between -- added on top of the VO2max work as the program peaks.",
                },
              ],
            },
            {
              name: "Strength Support",
              sessionType: "strength",
              exercises: [
                { kind: "strength", exerciseRef: "Bulgarian split squat", sets: 3, repsMin: 6, repsMax: 8, intensityType: "rpe", intensityValue: "7", coachingNotes: "Heavier than Base Building." },
                { kind: "strength", exerciseRef: "Single-leg Romanian deadlift", sets: 3, repsMin: 6, repsMax: 8, intensityType: "rpe", intensityValue: "7", coachingNotes: "Heavier than Base Building." },
                { kind: "strength", exerciseRef: "Plank", sets: 3, repsMin: 1, repsMax: 1, intensityType: "none", coachingNotes: "45-60 second holds." },
                { kind: "strength", exerciseRef: "Side plank", sets: 3, repsMin: 1, repsMax: 1, intensityType: "none", coachingNotes: "30-45 second holds per side." },
                { kind: "strength", exerciseRef: "Standing calf raise", sets: 4, repsMin: 15, repsMax: 20, intensityType: "rpe", intensityValue: "7", coachingNotes: "Added a set from Base Building." },
              ],
            },
          ],
        },
      ],
      sources: [
        {
          organization: "Hunter Allen (co-author with Andrew Coggan, Training and Racing with a Power Meter)",
          title: "Power Training Zones 101",
          url: "https://www.hunterallenpowerblog.com/2015/05/power-training-zones-101.html",
          retrievedAt: "2026-08-05",
        },
      ],
    },
  ],
};
