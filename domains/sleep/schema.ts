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
