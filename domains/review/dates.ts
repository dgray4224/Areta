import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";
import { resolveTimezone, todayForUser } from "@/domains/activity-summary/service";
import { localDateString } from "@/domains/activity-summary/timezone";

/** Not a Server Action file ("use server" files may only export async
 * functions) — these plain date helpers are shared by service.ts and
 * approve-flow.ts. Timezone-aware per profiles.time_zone via the same
 * todayForUser/resolveTimezone helpers used elsewhere (see
 * domains/activity-summary/service.ts) — previously used
 * `new Date().toISOString()` (UTC), which put the week boundary a day off
 * for any user not near UTC (the same bug class fixed in the Plan tab,
 * commit 4adcf23). */
export async function todayIso(supabase: SupabaseClient<Database>, userId: string): Promise<string> {
  return todayForUser(supabase, userId);
}

export async function reviewWeekStart(supabase: SupabaseClient<Database>, userId: string): Promise<string> {
  const timezone = await resolveTimezone(supabase, userId);
  const today = localDateString(new Date(), timezone);
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 6);
  return d.toISOString().slice(0, 10);
}
