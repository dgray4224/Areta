import type { ContentBatch } from "@/domains/trainingprogram/content-spec";

/**
 * Full-coverage replacement for olympic_weightlifter's 3 deactivated
 * programs (see migration 0053) -- those had 1-2 exercises per session
 * throughout (e.g. a single lift with no pulling/squat/accessory support).
 * Same fix pattern as 0049/powerlifter/hypertrophy. Greg Everett /
 * Catalyst Athletics is the specialist most associated with structured,
 * publicly-documented Olympic weightlifting programming (author of
 * "Olympic Weightlifting: A Complete Guide for Athletes and Coaches",
 * USA Weightlifting International Coach) -- his own program-selection
 * guide confirms the standard structure this program follows: 3-5
 * sessions/week built around the classic lifts, with pulling/squat
 * strength and (per his own note that "not all programs have accessory
 * work included") often real accessory work alongside them, not the
 * classic lift in isolation.
 */
export const batch: ContentBatch = {
  newExercises: [],
  programs: [
    {
      archetype: "olympic_weightlifter",
      slug: "oly-catalyst-full-coverage",
      name: "Catalyst Athletics Classic Lifts: Full Coverage",
      description:
        "A 4-day Olympic weightlifting split (Snatch, Clean & Jerk, Squat/Strength, Pulling & Technique) -- each day pairs the classic lift or its technique variations with real pulling, squatting, and accessory strength work, not the lift in isolation.",
      methodologyNote:
        "Greg Everett / Catalyst Athletics' publicly documented programming structure: 3-5 sessions per week organized around the classic lifts (snatch, clean & jerk), with dedicated squat/pulling strength work and -- per his own guidance that programs vary in whether they include 'accessory work (e.g. back and ab work and similar)' -- this program deliberately includes it throughout, rather than leaving each session as a single lift.",
      experienceLevel: "intermediate",
      sessionsPerWeekMin: 4,
      sessionsPerWeekMax: 4,
      equipmentRequired: ["Barbell", "Full gym access"],
      displayOrder: 1,
      phases: [
        {
          name: "Technique & Strength Foundation",
          focus: "Build technical consistency in the classic lifts alongside real pulling, squatting, and accessory strength.",
          lengthWeeks: 4,
          intensityStyle: "RPE 6-7 / 70-75% for classic lifts",
          isFinal: false,
          sessions: [
            {
              name: "Snatch Day",
              sessionType: "strength",
              exercises: [
                { kind: "strength", exerciseRef: "Snatch", sets: 5, repsMin: 2, repsMax: 2, intensityType: "percent_1rm", intensityValue: "70-75", coachingNotes: "Technical work at a manageable percentage -- the day's classic lift." },
                { kind: "strength", exerciseRef: "Snatch pull", sets: 4, repsMin: 3, repsMax: 3, intensityType: "rpe", intensityValue: "7", coachingNotes: "Pulling strength support for the snatch." },
                { kind: "strength", exerciseRef: "Snatch balance", sets: 4, repsMin: 2, repsMax: 2, intensityType: "rpe", intensityValue: "7", coachingNotes: "Speed-under-the-bar drill to sharpen the receiving position." },
                { kind: "strength", exerciseRef: "Overhead squat", sets: 3, repsMin: 3, repsMax: 3, intensityType: "rpe", intensityValue: "7", coachingNotes: "Overhead stability the snatch receiving position demands." },
                { kind: "strength", exerciseRef: "Front squat", sets: 3, repsMin: 3, repsMax: 3, intensityType: "rpe", intensityValue: "7", coachingNotes: "General squat strength underpins both competition lifts." },
              ],
            },
            {
              name: "Clean & Jerk Day",
              sessionType: "strength",
              exercises: [
                { kind: "strength", exerciseRef: "Clean and jerk", sets: 5, repsMin: 2, repsMax: 2, intensityType: "percent_1rm", intensityValue: "70-75", coachingNotes: "Technical work at a manageable percentage -- the day's classic lift." },
                { kind: "strength", exerciseRef: "Clean pull", sets: 4, repsMin: 3, repsMax: 3, intensityType: "rpe", intensityValue: "7", coachingNotes: "Pulling strength support for the clean." },
                { kind: "strength", exerciseRef: "Push press", sets: 4, repsMin: 3, repsMax: 3, intensityType: "rpe", intensityValue: "7", coachingNotes: "Overhead pressing strength the jerk relies on." },
                { kind: "strength", exerciseRef: "Front squat", sets: 4, repsMin: 3, repsMax: 3, intensityType: "rpe", intensityValue: "7", coachingNotes: "Front-rack strength for the clean's receiving position." },
              ],
            },
            {
              name: "Squat & Strength Day",
              sessionType: "strength",
              exercises: [
                { kind: "strength", exerciseRef: "Barbell back squat", sets: 5, repsMin: 3, repsMax: 3, intensityType: "rpe", intensityValue: "7", coachingNotes: "General squat strength -- underpins both classic lifts." },
                { kind: "strength", exerciseRef: "Good morning", sets: 3, repsMin: 8, repsMax: 8, intensityType: "rpe", intensityValue: "6", coachingNotes: "Posterior-chain accessory work." },
                { kind: "strength", exerciseRef: "Barbell overhead press", sets: 3, repsMin: 5, repsMax: 5, intensityType: "rpe", intensityValue: "7", coachingNotes: "Overhead pressing strength accessory." },
                { kind: "strength", exerciseRef: "Barbell row", sets: 3, repsMin: 8, repsMax: 8, intensityType: "rpe", intensityValue: "6-7", coachingNotes: "Upper-back/pulling accessory volume." },
                { kind: "strength", exerciseRef: "Plank", sets: 3, repsMin: 1, repsMax: 1, intensityType: "none", coachingNotes: "30-45 second holds -- core bracing carries into both lifts." },
              ],
            },
            {
              name: "Pulling & Technique Day",
              sessionType: "strength",
              exercises: [
                { kind: "strength", exerciseRef: "Hang clean", sets: 4, repsMin: 2, repsMax: 2, intensityType: "rpe", intensityValue: "7", coachingNotes: "Technique variation, starting from the hang." },
                { kind: "strength", exerciseRef: "Hang snatch", sets: 4, repsMin: 2, repsMax: 2, intensityType: "rpe", intensityValue: "7", coachingNotes: "Technique variation, starting from the hang." },
                { kind: "strength", exerciseRef: "Clean pull", sets: 3, repsMin: 3, repsMax: 3, intensityType: "rpe", intensityValue: "7", coachingNotes: "Additional pulling strength volume." },
                { kind: "strength", exerciseRef: "Snatch pull", sets: 3, repsMin: 3, repsMax: 3, intensityType: "rpe", intensityValue: "7", coachingNotes: "Additional pulling strength volume." },
                { kind: "strength", exerciseRef: "Barbell row", sets: 3, repsMin: 8, repsMax: 8, intensityType: "rpe", intensityValue: "6", coachingNotes: "General back/grip work between speed sets." },
              ],
            },
          ],
        },
        {
          name: "Intensification & Peaking",
          focus: "Heavier classic-lift percentages and squat/pulling loads as the cycle peaks.",
          lengthWeeks: 5,
          intensityStyle: "RPE 8-9 / 80-85% for classic lifts",
          isFinal: true,
          sessions: [
            {
              name: "Snatch Day",
              sessionType: "strength",
              exercises: [
                { kind: "strength", exerciseRef: "Snatch", sets: 5, repsMin: 1, repsMax: 2, intensityType: "percent_1rm", intensityValue: "80-85", coachingNotes: "Heavier than Foundation." },
                { kind: "strength", exerciseRef: "Snatch pull", sets: 4, repsMin: 2, repsMax: 2, intensityType: "rpe", intensityValue: "8", coachingNotes: "Heavier than Foundation." },
                { kind: "strength", exerciseRef: "Snatch balance", sets: 3, repsMin: 2, repsMax: 2, intensityType: "rpe", intensityValue: "8", coachingNotes: "Kept sharp, not necessarily heavier -- this is a speed/position drill." },
                { kind: "strength", exerciseRef: "Overhead squat", sets: 3, repsMin: 2, repsMax: 2, intensityType: "rpe", intensityValue: "8", coachingNotes: "Heavier than Foundation." },
                { kind: "strength", exerciseRef: "Front squat", sets: 3, repsMin: 2, repsMax: 2, intensityType: "rpe", intensityValue: "8", coachingNotes: "Heavier than Foundation." },
              ],
            },
            {
              name: "Clean & Jerk Day",
              sessionType: "strength",
              exercises: [
                { kind: "strength", exerciseRef: "Clean and jerk", sets: 5, repsMin: 1, repsMax: 2, intensityType: "percent_1rm", intensityValue: "80-85", coachingNotes: "Heavier than Foundation." },
                { kind: "strength", exerciseRef: "Clean pull", sets: 4, repsMin: 2, repsMax: 2, intensityType: "rpe", intensityValue: "8", coachingNotes: "Heavier than Foundation." },
                { kind: "strength", exerciseRef: "Push press", sets: 4, repsMin: 2, repsMax: 2, intensityType: "rpe", intensityValue: "8", coachingNotes: "Heavier than Foundation." },
                { kind: "strength", exerciseRef: "Front squat", sets: 4, repsMin: 2, repsMax: 2, intensityType: "rpe", intensityValue: "8", coachingNotes: "Heavier than Foundation." },
              ],
            },
            {
              name: "Squat & Strength Day",
              sessionType: "strength",
              exercises: [
                { kind: "strength", exerciseRef: "Barbell back squat", sets: 5, repsMin: 2, repsMax: 2, intensityType: "rpe", intensityValue: "8", coachingNotes: "Heavier than Foundation." },
                { kind: "strength", exerciseRef: "Good morning", sets: 3, repsMin: 6, repsMax: 6, intensityType: "rpe", intensityValue: "7", coachingNotes: "Heavier than Foundation." },
                { kind: "strength", exerciseRef: "Barbell overhead press", sets: 3, repsMin: 4, repsMax: 4, intensityType: "rpe", intensityValue: "8", coachingNotes: "Heavier than Foundation." },
                { kind: "strength", exerciseRef: "Barbell row", sets: 3, repsMin: 6, repsMax: 6, intensityType: "rpe", intensityValue: "7-8", coachingNotes: "Heavier than Foundation." },
                { kind: "strength", exerciseRef: "Plank", sets: 3, repsMin: 1, repsMax: 1, intensityType: "none", coachingNotes: "45-60 second holds." },
              ],
            },
            {
              name: "Pulling & Technique Day",
              sessionType: "strength",
              exercises: [
                { kind: "strength", exerciseRef: "Hang clean", sets: 4, repsMin: 1, repsMax: 2, intensityType: "rpe", intensityValue: "8", coachingNotes: "Heavier than Foundation." },
                { kind: "strength", exerciseRef: "Hang snatch", sets: 4, repsMin: 1, repsMax: 2, intensityType: "rpe", intensityValue: "8", coachingNotes: "Heavier than Foundation." },
                { kind: "strength", exerciseRef: "Clean pull", sets: 3, repsMin: 2, repsMax: 2, intensityType: "rpe", intensityValue: "8", coachingNotes: "Heavier than Foundation." },
                { kind: "strength", exerciseRef: "Snatch pull", sets: 3, repsMin: 2, repsMax: 2, intensityType: "rpe", intensityValue: "8", coachingNotes: "Heavier than Foundation." },
                { kind: "strength", exerciseRef: "Barbell row", sets: 3, repsMin: 6, repsMax: 6, intensityType: "rpe", intensityValue: "7", coachingNotes: "Heavier than Foundation." },
              ],
            },
          ],
        },
      ],
      sources: [
        {
          organization: "Greg Everett / Catalyst Athletics",
          title: "Guide to Catalyst Athletics Training Program Selection",
          url: "https://www.catalystathletics.com/article/2252/Guide-to-Training-Program-Selection/",
          retrievedAt: "2026-08-05",
        },
      ],
    },
  ],
};
