"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/platform/supabase/server";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";
import { createTimelineEventSchema } from "@/domains/timeline/schema";
import { logScheduleEvent } from "@/platform/scheduling/log-schedule-event";

export type TimelineEventView = {
  id: string;
  date: string;
  title: string;
  scheduledTime: string | null;
  endTime: string | null;
  completedAt: string | null;
  notes: string | null;
};

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, minutes));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}:00`;
}

/**
 * Ad-hoc timeline entries for the mobile "At a Glance" tray -- covers both
 * the preset "common task" quick-adds and fully custom user-typed titles
 * (same table, see migration 0022). Deliberately not the daily_actions/
 * tasks system; that integration is deferred to a future phase.
 */
export async function getTimelineEventsForDate(
  userId: string,
  date: string,
  client?: SupabaseClient<Database>
): Promise<TimelineEventView[]> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("custom_timeline_events")
    .select("id, date, title, scheduled_time, end_time, completed_at, notes")
    .eq("user_id", userId)
    .eq("date", date)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load timeline events: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    date: row.date,
    title: row.title,
    scheduledTime: row.scheduled_time,
    endTime: row.end_time,
    completedAt: row.completed_at,
    notes: row.notes,
  }));
}

export async function createTimelineEvent(
  userId: string,
  input: unknown,
  client?: SupabaseClient<Database>
): Promise<ActionResult<TimelineEventView>> {
  const parsed = createTimelineEventSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("custom_timeline_events")
    .insert({
      user_id: userId,
      date: parsed.data.date,
      title: parsed.data.title,
      notes: parsed.data.notes ?? null,
      scheduled_time: parsed.data.scheduledTime ?? null,
      end_time: parsed.data.scheduledTime ? (parsed.data.endTime ?? null) : null,
    })
    .select("id, date, title, scheduled_time, end_time, completed_at, notes")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to create timeline event" };
  }

  if (parsed.data.scheduledTime) {
    // Same reasoning as setTimelineEventScheduledTime -- setting a time at
    // creation is the same action as dragging it there later, so it logs
    // identically (normalized title as the label).
    await logScheduleEvent(
      userId,
      "custom",
      parsed.data.title.trim().toLowerCase(),
      data.id,
      parsed.data.scheduledTime,
      supabase,
      "planned"
    );
  }

  return {
    ok: true,
    data: {
      id: data.id,
      date: data.date,
      title: data.title,
      scheduledTime: data.scheduled_time,
      endTime: data.end_time,
      completedAt: data.completed_at,
      notes: data.notes,
    },
  };
}

/**
 * Rescheduling moves the whole window, not just the start. Two modes:
 *
 * - endTime === undefined (drag, or any single-time reschedule): end_time
 *   shifts by the same delta as the start, preserving whatever duration
 *   was already established rather than silently collapsing to a
 *   default.
 * - endTime provided explicitly (the edit sheet's start+end pickers,
 *   mirroring the "Add event" sheet): both are set exactly as given, no
 *   shift logic.
 *
 * Unscheduling (scheduledTime = null) clears end_time too either way,
 * matching "an unscheduled event has no time info at all."
 */
export async function setTimelineEventScheduledTime(
  userId: string,
  itemId: string,
  scheduledTime: string | null,
  client?: SupabaseClient<Database>,
  endTime?: string | null
): Promise<ActionResult> {
  const supabase = client ?? (await createClient());

  let resolvedEndTime: string | null = null;
  if (scheduledTime) {
    if (endTime !== undefined) {
      resolvedEndTime = endTime;
    } else {
      const { data: existing } = await supabase
        .from("custom_timeline_events")
        .select("scheduled_time, end_time")
        .eq("id", itemId)
        .eq("user_id", userId)
        .maybeSingle();
      if (existing?.scheduled_time && existing?.end_time) {
        const durationMinutes = timeToMinutes(existing.end_time) - timeToMinutes(existing.scheduled_time);
        resolvedEndTime = minutesToTime(timeToMinutes(scheduledTime) + durationMinutes);
      }
    }
  }

  const { data, error } = await supabase
    .from("custom_timeline_events")
    .update({ scheduled_time: scheduledTime, end_time: scheduledTime ? resolvedEndTime : null })
    .eq("id", itemId)
    .eq("user_id", userId)
    .select("title")
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }
  if (scheduledTime && data) {
    // Normalized so the same recurring one-off ("Study" scheduled again
    // next week, a brand new custom_timeline_events row) still
    // accumulates under one label instead of fragmenting per row.
    await logScheduleEvent(userId, "custom", data.title.trim().toLowerCase(), itemId, scheduledTime, supabase, "planned");
  }
  return { ok: true, data: undefined };
}

export async function setTimelineEventCompleted(
  userId: string,
  itemId: string,
  completed: boolean,
  client?: SupabaseClient<Database>
): Promise<ActionResult> {
  const supabase = client ?? (await createClient());
  const { error } = await supabase
    .from("custom_timeline_events")
    .update({ completed_at: completed ? new Date().toISOString() : null })
    .eq("id", itemId)
    .eq("user_id", userId);

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: undefined };
}

export async function setTimelineEventNotes(
  userId: string,
  itemId: string,
  notes: string | null,
  client?: SupabaseClient<Database>
): Promise<ActionResult> {
  const supabase = client ?? (await createClient());
  const { error } = await supabase
    .from("custom_timeline_events")
    .update({ notes })
    .eq("id", itemId)
    .eq("user_id", userId);

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: undefined };
}

export async function deleteTimelineEvent(
  userId: string,
  itemId: string,
  client?: SupabaseClient<Database>
): Promise<ActionResult> {
  const supabase = client ?? (await createClient());
  const { error } = await supabase
    .from("custom_timeline_events")
    .delete()
    .eq("id", itemId)
    .eq("user_id", userId);

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: undefined };
}
