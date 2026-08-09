import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";
import { todayForUser } from "@/domains/activity-summary/service";

/**
 * Best-effort upsert into schedule_events (see migrations 0026/0027) --
 * fire this whenever a meal/workout/custom item gets assigned a real
 * clock time, so a future pass has the history needed to learn typical
 * timing per user (per day-of-week, once enough history exists -- date
 * already carries that, no extra column needed). One row per (user, kind,
 * label, date): rescheduling the same thing again today overwrites
 * today's row rather than adding another -- only the settled time per day
 * matters for that analysis, not every intermediate drag adjustment.
 *
 * label is a stable *meaning*, not the underlying row's id -- meal_type
 * for meals, the fixed string "workout" for workouts, the normalized
 * title for custom events. This survives meal/workout plan regeneration
 * (which deletes and recreates every plan item with new ids) and lets a
 * recurring one-off custom event ("Study" scheduled again next week, a
 * brand new row) still accumulate into the same history. referenceId is
 * kept as an informational pointer to whichever row last wrote this day's
 * entry, not part of the uniqueness key.
 *
 * source distinguishes a planned/dragged time from one derived from
 * actual synced behavior (HealthKit, for workouts) -- callers writing a
 * "planned" value must check hasActualScheduleEventToday first and skip
 * entirely if actual data already exists for that day, since real
 * behavior is the stronger signal and must never be downgraded back to a
 * guess. "actual" writes never need that check; they always win.
 *
 * date defaults to the user's local today (per profiles.time_zone, via
 * todayForUser) -- right for every "planned" caller, since the scheduling
 * action itself is happening right now. Was UTC-server-clock-based until
 * 2026-08-09: since this table's whole purpose is learning per-day-of-week
 * routine timing, a planned action taken late in the evening in a
 * negative UTC offset was silently misfiled under the wrong calendar day.
 * The HealthKit "actual" path passes an explicit date instead: a synced
 * workout can be from earlier today, or catch up late for a prior day, so
 * it must be dated by when the workout actually happened (in the user's
 * own timezone), not by when the sync request happened to run.
 *
 * Never throws: this is pure analytics, a logging failure must not block
 * the actual scheduling action it's attached to.
 */
export async function logScheduleEvent(
  userId: string,
  kind: "meal" | "workout" | "custom",
  label: string,
  referenceId: string,
  scheduledTime: string,
  client: SupabaseClient<Database>,
  source: "planned" | "actual",
  date?: string
): Promise<void> {
  const resolvedDate = date ?? (await todayForUser(client, userId));
  const { error } = await client.from("schedule_events").upsert(
    {
      user_id: userId,
      kind,
      label,
      reference_id: referenceId,
      date: resolvedDate,
      scheduled_time: scheduledTime,
      source,
    },
    { onConflict: "user_id,kind,label,date" }
  );
  if (error) {
    console.warn(`[schedule_events] Failed to log ${kind}/${label} scheduling event:`, error.message);
  }
}

/** Whether today's row (if any) for this user/kind/label was written from
 * actual synced behavior rather than a plan/drag -- callers about to log a
 * "planned" value must check this first and skip if true. */
export async function hasActualScheduleEventToday(
  userId: string,
  kind: "meal" | "workout" | "custom",
  label: string,
  client: SupabaseClient<Database>
): Promise<boolean> {
  const today = await todayForUser(client, userId);
  const { data } = await client
    .from("schedule_events")
    .select("source")
    .eq("user_id", userId)
    .eq("kind", kind)
    .eq("label", label)
    .eq("date", today)
    .maybeSingle();
  return data?.source === "actual";
}
