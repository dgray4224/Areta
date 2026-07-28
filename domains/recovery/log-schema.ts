import { z } from "zod";

/** Daily recovery log — distinct from recovery/schema.ts, which captures
 * onboarding setup (clinician instructions, restrictions), not day-to-day
 * entries. LifeOS only organizes what's logged here; see CLAUDE.md §11. */
export const recoveryLogSchema = z.object({
  date: z.string().min(1, "Date is required"),
  pain: z.number().int().min(0).max(10).optional(),
  swelling: z.number().int().min(0).max(10).optional(),
  energy: z.number().int().min(1).max(5).optional(),
  braceCompliance: z.boolean().optional(),
  medicationAdherence: z.boolean().optional(),
  elevation: z.boolean().optional(),
  ice: z.boolean().optional(),
  approvedExercises: z.string().optional(),
  mobility: z.string().optional(),
  warningSigns: z.boolean(),
  warningSignsNotes: z.string().optional(),
  notes: z.string().optional(),
});

export type RecoveryLogInput = z.infer<typeof recoveryLogSchema>;
