import { z } from "zod";

export const weightLogSchema = z.object({
  loggedAt: z.string().min(1, "Date/time is required"),
  weight: z.number().positive("Enter a valid weight"),
  unit: z.enum(["lb", "kg"]),
  notes: z.string().optional(),
});

export type WeightLogInput = z.infer<typeof weightLogSchema>;
