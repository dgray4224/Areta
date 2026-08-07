import { z } from "zod";

/** Shared shape for the 16 simple point-in-time vitals types (everything
 * added beyond the original 5 HealthKit types except mindful_minutes, which
 * is duration-based — see importedMindfulSessionSchema below). Import-only,
 * no manual-entry counterpart (CLAUDE.md §14 — device-computed metrics like
 * VO2 max/HRV/resting heart rate don't make sense to hand-enter, matching
 * steps/heart-rate's existing pattern). */
export const importedVitalSampleSchema = z.object({
  loggedAt: z.string().min(1, "loggedAt is required"),
  value: z.number(),
  unit: z.string().min(1, "unit is required"),
  source: z.string().min(1, "source is required"),
  device: z.string().optional(),
  dedupKey: z.string().min(1, "dedupKey is required for imported entries"),
});

export type ImportedVitalSampleInput = z.infer<typeof importedVitalSampleSchema>;

/** HKCategoryTypeIdentifierMindfulSession — a duration, not a value, same
 * shape as a workout's start/end interval but without activity-type/energy/
 * distance fields. */
export const importedMindfulSessionSchema = z.object({
  startDate: z.string().min(1, "startDate is required"),
  endDate: z.string().min(1, "endDate is required"),
  source: z.string().min(1, "source is required"),
  device: z.string().optional(),
  dedupKey: z.string().min(1, "dedupKey is required for imported entries"),
});

export type ImportedMindfulSessionInput = z.infer<typeof importedMindfulSessionSchema>;
