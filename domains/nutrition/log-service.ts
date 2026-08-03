"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { nutritionLogSchema } from "@/domains/nutrition/log-schema";
import { createClient } from "@/platform/supabase/server";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";

export async function logNutrition(
  userId: string,
  input: unknown,
  client?: SupabaseClient<Database>
): Promise<ActionResult> {
  const parsed = nutritionLogSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const supabase = client ?? (await createClient());
  const { error } = await supabase.from("nutrition_logs").insert({
    user_id: userId,
    date: parsed.data.date,
    meal: parsed.data.meal,
    food: parsed.data.food,
    quantity: parsed.data.quantity ?? null,
    unit: parsed.data.unit || null,
    calories: parsed.data.calories ?? null,
    protein: parsed.data.protein ?? null,
    carbohydrates: parsed.data.carbohydrates ?? null,
    fat: parsed.data.fat ?? null,
    fiber: parsed.data.fiber ?? null,
    notes: parsed.data.notes || null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: undefined };
}

export async function getNutritionLogsForDate(userId: string, date: string, client?: SupabaseClient<Database>) {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("nutrition_logs")
    .select("id, meal, food, quantity, unit, calories, protein, carbohydrates, fat, fiber, notes")
    .eq("user_id", userId)
    .eq("date", date)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load nutrition logs: ${error.message}`);
  }
  return data ?? [];
}

export type DailyNutritionTotal = { date: string; calories: number; protein: number };

/** Sums same-day entries before returning — a day can have several food
 * log rows (one per meal), so this is daily totals, not raw rows. */
export async function getNutritionDailyTotals(
  userId: string,
  days = 30,
  client?: SupabaseClient<Database>
): Promise<DailyNutritionTotal[]> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - (days - 1));
  const sinceIso = since.toISOString().slice(0, 10);

  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("nutrition_logs")
    .select("date, calories, protein")
    .eq("user_id", userId)
    .gte("date", sinceIso);

  if (error) {
    throw new Error(`Failed to load nutrition totals: ${error.message}`);
  }

  const byDate = new Map<string, { calories: number; protein: number }>();
  for (const row of data ?? []) {
    const existing = byDate.get(row.date) ?? { calories: 0, protein: 0 };
    existing.calories += row.calories ?? 0;
    existing.protein += row.protein ?? 0;
    byDate.set(row.date, existing);
  }

  return Array.from(byDate.entries())
    .map(([date, totals]) => ({ date, ...totals }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
