import { z } from "zod";

export const sleepLogSchema = z.object({
  date: z.string().min(1, "Date is required"),
  bedtime: z.string().optional(),
  wakeTime: z.string().optional(),
  totalDurationMinutes: z.number().int().min(0).optional(),
  quality: z.number().int().min(1).max(5).optional(),
  interruptions: z.number().int().min(0).optional(),
  notes: z.string().optional(),
});

export type SleepLogInput = z.infer<typeof sleepLogSchema>;

/** Separate from sleepLogSchema (the manual-entry form's shape) — see the
 * matching note in domains/weight/schema.ts. Used by /api/health-sync
 * (CLAUDE.md §14 Apple Health Roadmap). */
export const importedSleepLogSchema = z.object({
  date: z.string().min(1, "date is required"),
  bedtime: z.string().optional(),
  wakeTime: z.string().optional(),
  totalDurationMinutes: z.number().int().min(0).optional(),
  quality: z.number().int().min(1).max(5).optional(),
  interruptions: z.number().int().min(0).optional(),
  source: z.string().min(1, "source is required"),
  device: z.string().optional(),
  dedupKey: z.string().min(1, "dedupKey is required for imported entries"),
});

export type ImportedSleepLogInput = z.infer<typeof importedSleepLogSchema>;
