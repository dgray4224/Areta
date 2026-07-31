"use server";

import { createClient } from "@/platform/supabase/server";
import { getUpcomingEvents } from "@/domains/calendar/events-service";
import { buildDailyAvailability, type DayWindow } from "@/domains/calendar/freebusy";
import type { OpenWindow } from "@/domains/calendar/schema";

const DAYS_AHEAD = 7;
const DEFAULT_WAKE_TIME = "07:00";
const DEFAULT_BED_TIME = "22:00";

/**
 * Recommended open windows for the next 7 days, cross-referencing connected
 * calendars against the user's wake/bed time (captured at onboarding).
 * Deterministic (CLAUDE.md rule 6) — no AI involved. V1 surfaces "here are
 * your open blocks this week"; it does not bind a window to a specific
 * goal/task (see the plan).
 */
export async function getRecommendedTimes(userId: string): Promise<OpenWindow[]> {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("wake_time, bed_time")
    .eq("id", userId)
    .maybeSingle();

  const wakeTime = profile?.wake_time?.slice(0, 5) ?? DEFAULT_WAKE_TIME;
  const bedTime = profile?.bed_time?.slice(0, 5) ?? DEFAULT_BED_TIME;

  const days: DayWindow[] = Array.from({ length: DAYS_AHEAD }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + i);
    return { date: d.toISOString().slice(0, 10), wakeTime, bedTime };
  });

  const timeMin = `${days[0].date}T00:00:00.000Z`;
  const timeMax = `${days[days.length - 1].date}T23:59:59.999Z`;
  const events = await getUpcomingEvents(userId, { timeMin, timeMax });

  return buildDailyAvailability(
    events.map((e) => ({ start: e.startsAt, end: e.endsAt })),
    days
  );
}
