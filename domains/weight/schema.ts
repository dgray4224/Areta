import { z } from "zod";

export const weightLogSchema = z.object({
  loggedAt: z.string().min(1, "Date/time is required"),
  weight: z.number().positive("Enter a valid weight"),
  unit: z.enum(["lb", "kg"]),
  notes: z.string().optional(),
});

export type WeightLogInput = z.infer<typeof weightLogSchema>;

/** Separate from weightLogSchema (the manual-entry form's shape) rather
 * than folding provenance fields into it — the existing log form has no use
 * for device/dedupKey, and importing shouldn't change what that form
 * requires. `value`/`unit` (not `weight`) — same shape as
 * domains/vitals/schema.ts's importedVitalSampleSchema, so the mobile
 * client sends one uniform envelope for every point-in-time HealthKit type
 * (weight/steps/heart_rate plus the 16 vitals types) rather than a
 * per-type field name. Used by /api/health-sync (CLAUDE.md §14 Apple
 * Health Roadmap). */
export const importedWeightLogSchema = z.object({
  loggedAt: z.string().min(1, "loggedAt is required"),
  value: z.number().positive(),
  unit: z.enum(["lb", "kg"]),
  source: z.string().min(1, "source is required"),
  device: z.string().optional(),
  dedupKey: z.string().min(1, "dedupKey is required for imported entries"),
});

export type ImportedWeightLogInput = z.infer<typeof importedWeightLogSchema>;
