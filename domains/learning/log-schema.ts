import { z } from "zod";

/** Daily study session log — distinct from learning/schema.ts, which
 * captures onboarding goals, not individual sessions. */
export const studySessionSchema = z.object({
  date: z.string().min(1, "Date is required"),
  track: z.string().optional(),
  task: z.string().min(1, "Describe what you worked on"),
  durationMinutes: z.number().int().min(0).optional(),
  focus: z.number().int().min(1).max(5).optional(),
  output: z.string().optional(),
  link: z.string().optional(),
  reflection: z.string().optional(),
  nextStep: z.string().optional(),
});

export type StudySessionInput = z.infer<typeof studySessionSchema>;
