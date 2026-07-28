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
