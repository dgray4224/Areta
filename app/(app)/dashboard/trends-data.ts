import "server-only";
import { createClient } from "@/platform/supabase/server";
import { getRecentWeightLogs } from "@/domains/weight/service";
import { getRecentSleepLogs } from "@/domains/sleep/service";
import { getRecentRecoveryLogs } from "@/domains/recovery/log-service";
import { getNutritionDailyTotals } from "@/domains/nutrition/log-service";
import { getTaskCompletionByDay } from "@/domains/tasks/service";
import { computeSevenDayMovingAverage, computeRecentWeightDelta } from "@/domains/weight/trend";
import { getApprovedParameterValue } from "@/domains/parameters/service";
import type { WeightTrendDatum } from "@/platform/ui/charts/WeightTrendChart";
import type { SleepTrendDatum } from "@/platform/ui/charts/SleepTrendChart";
import type { NutritionAdherenceDatum } from "@/platform/ui/charts/NutritionAdherenceChart";
import type { TaskCompletionDatum } from "@/platform/ui/charts/TaskCompletionChart";
import type { RecoveryTrendDatum } from "@/platform/ui/charts/RecoveryTrendChart";

const LB_PER_KG = 2.2046226218;
const TREND_DAYS = 30;

export type DashboardTrends = {
  weight: { data: WeightTrendDatum[]; unit: string; recentDelta: number | null };
  sleep: SleepTrendDatum[];
  nutrition: { data: NutritionAdherenceDatum[]; target: number | null };
  tasks: TaskCompletionDatum[];
  recovery: RecoveryTrendDatum[];
};

export async function getDashboardTrends(userId: string): Promise<DashboardTrends> {
  const supabase = await createClient();

  const [{ data: profile }, weightLogs, sleepLogs, recoveryLogs, nutritionTotals, taskCompletion, calorieTarget] =
    await Promise.all([
      supabase.from("profiles").select("units").eq("id", userId).maybeSingle(),
      getRecentWeightLogs(userId, 60),
      getRecentSleepLogs(userId, TREND_DAYS),
      getRecentRecoveryLogs(userId, TREND_DAYS),
      getNutritionDailyTotals(userId, TREND_DAYS),
      getTaskCompletionByDay(userId, TREND_DAYS),
      getApprovedParameterValue(userId, "nutrition", "calorie_target"),
    ]);

  const preferredUnit: "lb" | "kg" = profile?.units === "metric" ? "kg" : "lb";
  const normalizedWeights = weightLogs.map((w) => ({
    loggedAt: w.logged_at,
    weight: w.unit === preferredUnit ? w.weight : w.unit === "lb" ? w.weight / LB_PER_KG : w.weight * LB_PER_KG,
  }));
  const weightMovingAverage = computeSevenDayMovingAverage(normalizedWeights);
  const weightTrend = weightMovingAverage.map((p) => ({
    date: p.loggedAt.slice(0, 10),
    weight: p.weight,
    sevenDayAverage: p.sevenDayAverage,
  }));
  const weightRecentDelta = computeRecentWeightDelta(weightMovingAverage);

  const sleep: SleepTrendDatum[] = [...sleepLogs]
    .reverse()
    .map((s) => ({
      date: s.date,
      hours: s.total_duration_minutes !== null ? Math.round((s.total_duration_minutes / 60) * 10) / 10 : null,
    }));

  const recovery: RecoveryTrendDatum[] = [...recoveryLogs]
    .reverse()
    .map((r) => ({ date: r.date, pain: r.pain, swelling: r.swelling }));

  const nutrition: NutritionAdherenceDatum[] = nutritionTotals.map((n) => ({
    date: n.date,
    calories: n.calories > 0 ? n.calories : null,
  }));

  return {
    weight: { data: weightTrend, unit: preferredUnit, recentDelta: weightRecentDelta },
    sleep,
    nutrition: { data: nutrition, target: calorieTarget },
    tasks: taskCompletion,
    recovery,
  };
}
