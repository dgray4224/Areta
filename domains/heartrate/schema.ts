import { z } from "zod";

/** Import-only for v1 — heart rate has no manual-entry form, only the
 * HealthKit companion app posts these via /api/health-sync (CLAUDE.md
 * §14 Apple Health Roadmap). */
export const importedHeartRateLogSchema = z.object({
  loggedAt: z.string().min(1, "loggedAt is required"),
  bpm: z.number().positive(),
  source: z.string().min(1, "source is required"),
  device: z.string().optional(),
  dedupKey: z.string().min(1, "dedupKey is required for imported entries"),
});

export type ImportedHeartRateLogInput = z.infer<typeof importedHeartRateLogSchema>;
