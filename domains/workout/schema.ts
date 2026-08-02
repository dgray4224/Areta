import { z } from "zod";

/** Import-only for v1 — raw HealthKit workout sessions, distinct from
 * exercise_logs (manual/planned exercise logging) and workoutplan
 * (the app's own workout planning domain). Only the HealthKit companion
 * app posts these via /api/health-sync (CLAUDE.md §14 Apple Health
 * Roadmap). */
export const importedWorkoutLogSchema = z.object({
  startDate: z.string().min(1, "startDate is required"),
  endDate: z.string().min(1, "endDate is required"),
  activityType: z.string().min(1, "activityType is required"),
  durationMinutes: z.number().int().min(0),
  totalEnergyBurnedKcal: z.number().min(0).optional(),
  totalDistanceMeters: z.number().min(0).optional(),
  source: z.string().min(1, "source is required"),
  device: z.string().optional(),
  dedupKey: z.string().min(1, "dedupKey is required for imported entries"),
});

export type ImportedWorkoutLogInput = z.infer<typeof importedWorkoutLogSchema>;
