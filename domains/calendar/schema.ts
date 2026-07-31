import { z } from "zod";

export const calendarProviderIdSchema = z.enum(["google", "microsoft", "apple"]);

/** Apple's app-specific passwords are always four lowercase groups of four
 * letters, e.g. abcd-efgh-ijkl-mnop — validating the shape here catches a
 * typo/paste error before it becomes a confusing CalDAV auth failure. */
export const appleConnectSchema = z.object({
  appleId: z.string().email("Enter the Apple ID email you use for iCloud"),
  appSpecificPassword: z
    .string()
    .regex(
      /^[a-z]{4}-[a-z]{4}-[a-z]{4}-[a-z]{4}$/i,
      "App-specific passwords look like abcd-efgh-ijkl-mnop"
    ),
});
export type AppleConnectInput = z.infer<typeof appleConnectSchema>;

export type CalendarConnection = {
  provider: "google" | "microsoft" | "apple";
  accountEmail: string | null;
  connectedAt: string;
};

export type UpcomingEvent = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  source: "google" | "microsoft" | "apple";
};

export type OpenWindow = {
  date: string;
  start: string;
  end: string;
  durationMinutes: number;
  dayPart: "morning" | "afternoon" | "evening";
};
