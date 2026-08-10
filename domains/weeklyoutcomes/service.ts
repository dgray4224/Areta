"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";
import { createClient } from "@/platform/supabase/server";
import type { ActionResult } from "@/platform/auth/actions";

export type WeeklyOutcomeCheckIn = {
  id: string;
  outcomeText: string;
  status: "proposed" | "active" | "completed" | "dropped";
};

/** Powers the Review tab's Check-in sub-tab — this week's proposed
 * outcomes (set during onboarding, or rolled forward by
 * approveWeeklyReview after a brief's priorities are approved) with a
 * hit/missed status. Matches areta-mobile's lib/queries/weeklyOutcomes.ts
 * getWeeklyOutcomesCheckIn — that one reads Supabase directly from the
 * client (RLS-scoped); this is the equivalent server-side read since the
 * web app is already authenticated via cookies, not a bearer token. */
export async function getWeeklyOutcomesCheckIn(
  userId: string,
  client?: SupabaseClient<Database>
): Promise<WeeklyOutcomeCheckIn[]> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("weekly_outcomes")
    .select("id, outcome_text, status")
    .eq("user_id", userId)
    .in("status", ["proposed", "active"])
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load weekly outcomes: ${error.message}`);
  }
  return (data ?? []).map((o) => ({
    id: o.id,
    outcomeText: o.outcome_text,
    status: o.status as WeeklyOutcomeCheckIn["status"],
  }));
}

/** Same RLS-scoped pattern as the read above, plus an explicit user_id
 * match on the update itself (belt-and-suspenders alongside RLS) so this
 * can't silently no-op cross-user. */
export async function updateWeeklyOutcomeStatus(
  userId: string,
  id: string,
  status: "completed" | "dropped",
  client?: SupabaseClient<Database>
): Promise<ActionResult> {
  const supabase = client ?? (await createClient());
  const { error } = await supabase.from("weekly_outcomes").update({ status }).eq("id", id).eq("user_id", userId);

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: undefined };
}
