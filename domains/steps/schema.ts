import { z } from "zod";

/** Import-only for v1 — steps have no manual-entry form, only the
 * HealthKit companion app posts these via /api/health-sync (CLAUDE.md
 * §14 Apple Health Roadmap). */
export const importedStepLogSchema = z.object({
  loggedAt: z.string().min(1, "loggedAt is required"),
  count: z.number().int().min(0),
  source: z.string().min(1, "source is required"),
  device: z.string().optional(),
  dedupKey: z.string().min(1, "dedupKey is required for imported entries"),
});

export type ImportedStepLogInput = z.infer<typeof importedStepLogSchema>;
