import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";
import { resolveTimezone } from "@/domains/activity-summary/service";
import { localDateString } from "@/domains/activity-summary/timezone";
import { computeMonthPacing, daysInMonth, shiftMonth, type MonthPacing, type MonthPacingRow } from "./month-pacing";

/** 12 baseline months plus the target month; the same-month-last-year
 * baseline is the far edge. */
const LOOKBACK_MONTHS = 13;
const PAGE_SIZE = 1000;

async function fetchNutritionDays(
  supabase: SupabaseClient<Database>,
  userId: string,
  fromDay: string,
  toDay: string
): Promise<string[]> {
  // Paged: a year of meals is several thousand rows, well past
  // PostgREST's silent 1,000-row cap.
  const days = new Set<string>();
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("nutrition_logs")
      .select("date")
      .eq("user_id", userId)
      .gte("date", fromDay)
      .lte("date", toDay)
      .order("date", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`month pacing: nutrition fetch failed: ${error.message}`);
    for (const row of data ?? []) days.add(row.date);
    if (!data || data.length < PAGE_SIZE) break;
  }
  return [...days];
}

/**
 * Month pacing for `month` (YYYY-MM; defaults to the user's current
 * local month). Reads ~13 months of daily summaries — at most ~400 rows,
 * under the PostgREST cap, but paged anyway so a future retention change
 * can't silently truncate the baseline.
 */
export async function getMonthPacing(
  userId: string,
  supabase: SupabaseClient<Database>,
  monthParam: string | null
): Promise<MonthPacing> {
  const timezone = await resolveTimezone(supabase, userId);
  const today = localDateString(new Date(), timezone);
  const month = monthParam ?? today.slice(0, 7);

  const fromDay = `${shiftMonth(month, -LOOKBACK_MONTHS)}-01`;
  const toDay = `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;

  const rows: MonthPacingRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("activity_daily_summaries")
      .select("day, steps_total, workout_count, workout_total_minutes, sleep_logged, sleep_total_duration_minutes")
      .eq("user_id", userId)
      .gte("day", fromDay)
      .lte("day", toDay)
      .order("day", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`month pacing: summaries fetch failed: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }

  const nutritionDays = await fetchNutritionDays(supabase, userId, fromDay, toDay);
  return computeMonthPacing({ rows, nutritionDays, month, today });
}
