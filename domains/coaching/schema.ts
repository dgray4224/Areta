import { z } from "zod";

export const coachingSchema = z.object({
  tone: z.enum(["direct", "gentle"]),
  planningStyle: z.enum(["strict", "flexible"]),
  reminderPreference: z.enum(["frequent", "minimal", "none"]),
  explanationDepth: z.enum(["brief", "detailed"]),
  rescheduleMissedTasks: z.boolean(),
  neverRecommend: z.array(z.string()),
});

export type CoachingInput = z.infer<typeof coachingSchema>;

/** Suggested chip options for "never recommend" — a starting point the
 * user can add to, not an exhaustive list. */
export const NEVER_RECOMMEND_SUGGESTIONS = [
  "Red meat",
  "Alcohol",
  "Early-morning workouts",
  "Running",
  "Dairy",
  "Processed foods",
  "Fasting",
  "Late-night tasks",
];
