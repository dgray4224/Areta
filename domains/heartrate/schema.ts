import { z } from "zod";

/** Import-only for v1 — heart rate has no manual-entry form, only the
 * HealthKit companion app posts these via /api/health-sync (CLAUDE.md
 * §14 Apple Health Roadmap). `value`/`unit` (not `bpm`) — same shape as
 * domains/vitals/schema.ts's importedVitalSampleSchema, see the matching
 * note in domains/weight/schema.ts. */
export const importedHeartRateLogSchema = z.object({
  loggedAt: z.string().min(1, "loggedAt is required"),
  value: z.number().positive(),
  unit: z.string().min(1, "unit is required"),
  source: z.string().min(1, "source is required"),
  device: z.string().optional(),
  dedupKey: z.string().min(1, "dedupKey is required for imported entries"),
});

export type ImportedHeartRateLogInput = z.infer<typeof importedHeartRateLogSchema>;
