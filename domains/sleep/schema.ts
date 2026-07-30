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

/** Suggested chip options for common sleep disruptors — a starting point
 * the user can add to, not an exhaustive list. */
export const SLEEP_DISRUPTOR_SUGGESTIONS = [
  "Screens before bed",
  "Caffeine late in day",
  "Irregular schedule",
  "Stress / racing thoughts",
  "Noise or light",
  "Alcohol",
];

/** Onboarding goal capture — direct preference capture, no calculation
 * engine (unlike Nutrition/Exercise, there's no real derivation to perform
 * here; see the plan's Context for why). */
export const sleepGoalsSchema = z.object({
  targetBedtime: z.string().optional(),
  targetWakeTime: z.string().optional(),
  targetDurationHours: z.number().positive().optional(),
  disruptors: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export type SleepGoalsInput = z.infer<typeof sleepGoalsSchema>;
