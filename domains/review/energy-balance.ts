import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";
import { createClient } from "@/platform/supabase/server";
import { getVitalsTrend } from "@/domains/review/vitals";
import { getApprovedParameterValue } from "@/domains/parameters/service";

const DEFAULT_DAYS = 14;
const MAX_DAYS = 90;

export type EnergyBalanceDay = {
  date: string;
  caloriesIn: number | null;
  caloriesOutActive: number | null;
  caloriesOutBasal: number | null;
  /** active+basal when either HealthKit series has a reading that day,
   * otherwise the already-approved Mifflin-St Jeor maintenance-calories
   * estimate (domains/parameters/nutrition-calc.ts) as a fallback. */
  caloriesOutTotal: number | null;
  usedFallbackBmr: boolean;
  /** caloriesIn - caloriesOutTotal; null whenever either side is null —
   * never a half-real number. */
  netCalories: number | null;
};

export type EnergyBalanceTrend = {
  days: EnergyBalanceDay[];
  weeklyAverageNet: number | null;
};

/**
 * Nets logged intake against HealthKit energy-out data, falling back to
 * the already-approved BMR estimate on days with no HealthKit energy
 * reading -- deliberately does NOT use resting heart rate anywhere (it
 * isn't a real calorie-burn input; it's a separate cardiovascular/
 * recovery signal already surfaced on its own in the Vitals sub-tab).
 *
 * Reuses getVitalsTrend (domains/review/vitals.ts) for the "calories out"
 * side rather than a new health_metrics aggregation -- it already sums
 * active_energy/basal_energy correctly per day (SUM_METRICS), it's just
 * never been called with those metric types before this. No schema
 * change: extending activity_daily_summaries with an energy column would
 * also require wiring a recompute trigger into the HealthKit ingestion
 * write path (app/api/health-sync/route.ts), real added surface area this
 * Review-tab-scoped feature doesn't need -- reconsider that once another
 * feature (e.g. a Dashboard "calories burned today" tile) needs a
 * persisted daily rollup instead of an on-demand trend query.
 *
 * Only emits a day when there's *some* real data (intake or energy-out)
 * for it -- never fabricates a day out of thin air, same "real numbers
 * only" rule the rest of this domain follows.
 */
export async function getEnergyBalanceTrend(
  userId: string,
  days: number = DEFAULT_DAYS,
  client?: SupabaseClient<Database>
): Promise<EnergyBalanceTrend> {
  const supabase = client ?? (await createClient());
  const clampedDays = Math.min(MAX_DAYS, Math.max(1, days));
  const windowStart = new Date(Date.now() - clampedDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [energyTrend, { data: nutritionRows }, maintenanceCalories] = await Promise.all([
    getVitalsTrend(userId, ["active_energy", "basal_energy"], clampedDays, supabase),
    supabase.from("nutrition_logs").select("date, calories").eq("user_id", userId).gte("date", windowStart),
    getApprovedParameterValue(userId, "nutrition", "maintenance_calories", supabase),
  ]);

  const activeByDay = new Map(energyTrend.active_energy?.map((d) => [d.date, d.value]) ?? []);
  const basalByDay = new Map(energyTrend.basal_energy?.map((d) => [d.date, d.value]) ?? []);

  const caloriesInByDay = new Map<string, number>();
  for (const row of nutritionRows ?? []) {
    if (row.calories === null) continue;
    caloriesInByDay.set(row.date, (caloriesInByDay.get(row.date) ?? 0) + row.calories);
  }

  const allDates = new Set([...activeByDay.keys(), ...basalByDay.keys(), ...caloriesInByDay.keys()]);
  const days_: EnergyBalanceDay[] = Array.from(allDates)
    .sort()
    .map((date) => {
      const active = activeByDay.get(date) ?? null;
      const basal = basalByDay.get(date) ?? null;
      const hasHealthKitEnergy = active !== null || basal !== null;
      const caloriesOutTotal = hasHealthKitEnergy ? (active ?? 0) + (basal ?? 0) : maintenanceCalories;
      const caloriesIn = caloriesInByDay.get(date) ?? null;

      return {
        date,
        caloriesIn,
        caloriesOutActive: active,
        caloriesOutBasal: basal,
        caloriesOutTotal,
        usedFallbackBmr: !hasHealthKitEnergy && caloriesOutTotal !== null,
        netCalories: caloriesIn !== null && caloriesOutTotal !== null ? Math.round(caloriesIn - caloriesOutTotal) : null,
      };
    });

  const netValues = days_.map((d) => d.netCalories).filter((v): v is number => v !== null);
  const weeklyAverageNet =
    netValues.length > 0 ? Math.round(netValues.reduce((sum, v) => sum + v, 0) / netValues.length) : null;

  return { days: days_, weeklyAverageNet };
}
