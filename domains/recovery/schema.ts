import { z } from "zod";

/** Optional module (CLAUDE.md Phase 1). LifeOS only organizes
 * clinician-provided instructions — it must never invent medical
 * progression (§11) — so acknowledging the warning-sign guidance is
 * required whenever the user doesn't skip this step outright. */
export const recoverySchema = z
  .object({
    skipped: z.boolean(),
    injuryOrSurgeryDate: z.string().optional(),
    currentPhase: z.string().optional(),
    clinicianInstructions: z.string().optional(),
    restrictions: z.string().optional(),
    mobility: z.string().optional(),
    physicalTherapySchedule: z.string().optional(),
    trackPainAndSwelling: z.boolean().optional(),
    warningSignsAcknowledged: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.skipped && !data.warningSignsAcknowledged) {
      ctx.addIssue({
        code: "custom",
        path: ["warningSignsAcknowledged"],
        message:
          "Acknowledge the warning-sign guidance to continue, or skip this step.",
      });
    }
  });

export type RecoveryInput = z.infer<typeof recoverySchema>;

export const skippedRecovery: RecoveryInput = { skipped: true };
