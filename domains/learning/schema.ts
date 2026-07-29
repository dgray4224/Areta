import { z } from "zod";

export const learningSchema = z.object({
  careerDirection: z.array(z.string()).optional(),
  currentSkills: z.array(z.string()).optional(),
  desiredSkills: z.array(z.string()).optional(),
  currentProjects: z.string().optional(),
  preferredFormat: z
    .enum(["reading", "video", "project", "course", "mixed"])
    .optional(),
  weeklyAvailableHours: z.number().min(0).optional(),
  formalCoursePlans: z.string().optional(),
});

export type LearningInput = z.infer<typeof learningSchema>;

/** Suggested chip options for the "select all that apply" onboarding
 * fields — a starting point the user can add to, not an exhaustive list. */
export const CAREER_DIRECTION_SUGGESTIONS = [
  "AI engineering",
  "Data engineering",
  "Software engineering",
  "Product management",
  "Data science",
  "Cloud / DevOps",
  "Cybersecurity",
  "Management / leadership",
];

export const CURRENT_SKILL_SUGGESTIONS = [
  "Python",
  "SQL",
  "JavaScript / TypeScript",
  "Excel",
  "Statistics",
  "Project management",
  "Public speaking",
  "Writing",
];

export const DESIRED_SKILL_SUGGESTIONS = [
  "AI / machine learning",
  "Cloud platforms (AWS/Azure/GCP)",
  "Data engineering",
  "Production app development",
  "System design",
  "Leadership",
  "Public speaking",
];
