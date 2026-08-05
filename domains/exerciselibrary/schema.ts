import { z } from "zod";

// No `.default([])` on the array fields — see the equivalent comment in
// domains/expertregistry/schema.ts for why: `csvToArray` (reused from
// there) always returns a real array at the react-hook-form boundary, so
// giving zod its own default would make zodResolver's input type diverge
// from useForm<ExerciseAdminInput>()'s single generic.
const stringArray = z.array(z.string());

export const exerciseAdminSchema = z.object({
  name: z.string().min(1, "Name is required"),
  canonicalName: z.string().min(1, "Canonical name is required"),
  movementPattern: z.string().min(1, "Movement pattern is required"),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  equipmentRequired: stringArray,
  primaryMuscleGroups: stringArray,
  secondaryMuscleGroups: stringArray,
  archetypeTags: stringArray,
  aliases: stringArray,
  setupRequirements: stringArray,
  limitationTags: stringArray,
  modality: z.enum(["resistance", "aerobic", "mobility", "power"]).optional(),
  unilateral: z.boolean(),
  compound: z.boolean(),
  contraindicationNotes: z.string().optional(),
  instructions: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  videoUrl: z.string().url().optional().or(z.literal("")),
  status: z.enum(["active", "review", "deprecated"]),
});
export type ExerciseAdminInput = z.infer<typeof exerciseAdminSchema>;
