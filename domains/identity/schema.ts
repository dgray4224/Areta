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
  /** 0 = Sunday .. 6 = Saturday, matches the DB check constraint. */
  weeklyReviewDay: z.number().int().min(0).max(6),
  groceryDay: z.number().int().min(0).max(6),
  mealPrepDay: z.number().int().min(0).max(6),
});

export type IdentityInput = z.infer<typeof identitySchema>;

/** Work/school context — deliberately not part of onboarding (CLAUDE.md
 * is being trimmed for this phase; this can be deciphered from a future
 * calendar integration instead). Lives in Settings -> Personalization,
 * fully optional. Still the same `profiles` columns as before. */
export const workScheduleSchema = z.object({
  workStatus: z.string().optional(),
  workHoursNote: z.string().optional(),
  schoolCommitments: z.string().optional(),
  learningTimeMinutesPerWeek: z.number().int().min(0).optional(),
});

export type WorkScheduleInput = z.infer<typeof workScheduleSchema>;

/** Settings -> Profile avatar upload. Separate from identitySchema, same
 * split areta-mobile uses (profile.tsx's photo saves immediately on
 * upload, independent of the rest of the form's Save button). */
export const avatarUrlSchema = z.object({
  avatarUrl: z.string().url(),
});

export type AvatarUrlInput = z.infer<typeof avatarUrlSchema>;

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
