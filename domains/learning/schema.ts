import { z } from "zod";

export const learningSchema = z.object({
  careerDirection: z.string().optional(),
  currentSkills: z.string().optional(),
  desiredSkills: z.string().optional(),
  currentProjects: z.string().optional(),
  preferredFormat: z
    .enum(["reading", "video", "project", "course", "mixed"])
    .optional(),
  weeklyAvailableHours: z.number().min(0).optional(),
  formalCoursePlans: z.string().optional(),
});

export type LearningInput = z.infer<typeof learningSchema>;
