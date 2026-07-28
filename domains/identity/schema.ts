import { z } from "zod";

const timeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM");

export const identitySchema = z.object({
  fullName: z.string().min(1, "Name is required"),
  timeZone: z.string().min(1, "Time zone is required"),
  units: z.enum(["metric", "imperial"]),
  wakeTime: timeString,
  bedTime: timeString,
  workStatus: z.string().min(1, "Work status is required"),
  workHoursNote: z.string().optional(),
  schoolCommitments: z.string().optional(),
  /** 0 = Sunday .. 6 = Saturday, matches the DB check constraint. */
  weeklyReviewDay: z.number().int().min(0).max(6),
  groceryDay: z.number().int().min(0).max(6),
  mealPrepDay: z.number().int().min(0).max(6),
  learningTimeMinutesPerWeek: z.number().int().min(0),
});

export type IdentityInput = z.infer<typeof identitySchema>;

/** 0 = Sunday .. 6 = Saturday, for weekday <select> options. */
export const WEEKDAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
] as const;
