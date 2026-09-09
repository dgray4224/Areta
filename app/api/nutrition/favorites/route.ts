import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { QUICK_ESTIMATE_NOTE } from "@/domains/nutrition/quick-log";

/**
 * The foods this person logs off-plan again and again -- a protein shake,
 * the Tuesday burrito -- ranked by how often, carrying the macros from the
 * most recent time so one tap can re-log them (mobile Today → Nutrition).
 *
 * Two kinds of rows are left out: the ones the planned-meal checkbox
 * writes (those are the plan, not a favourite, and would otherwise crowd
 * out everything else), and quick estimates ("Ate out (normal)"), which
 * are deliberately vague and shouldn't harden into a favourite.
 */
const LOOKBACK_DAYS = 90;
const MAX_ROWS = 400;
const MAX_FAVORITES = 8;

export type FavoriteFood = {
  food: string;
  count: number;
  quantity: number | null;
  unit: string | null;
  calories: number | null;
  protein: number | null;
  carbohydrates: number | null;
  fat: number | null;
  fiber: number | null;
};

export async function GET(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - LOOKBACK_DAYS);
  const sinceIso = since.toISOString().slice(0, 10);

  const [{ data: rows, error }, { data: planLinks, error: linkError }] = await Promise.all([
    supabase
      .from("nutrition_logs")
      .select("id, food, quantity, unit, calories, protein, carbohydrates, fat, fiber, notes, created_at")
      .eq("user_id", userId)
      .gte("date", sinceIso)
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS),
    supabase.from("meal_plan_items").select("nutrition_log_id").eq("user_id", userId).not("nutrition_log_id", "is", null),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 });

  const fromPlan = new Set((planLinks ?? []).map((l) => l.nutrition_log_id));
  const byFood = new Map<string, FavoriteFood>();
  for (const row of rows ?? []) {
    if (fromPlan.has(row.id) || row.notes === QUICK_ESTIMATE_NOTE) continue;
    const key = row.food.trim().toLowerCase();
    if (!key) continue;
    const existing = byFood.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    // Rows arrive newest first, so the first one seen carries the macros.
    byFood.set(key, {
      food: row.food.trim(),
      count: 1,
      quantity: row.quantity,
      unit: row.unit,
      calories: row.calories,
      protein: row.protein,
      carbohydrates: row.carbohydrates,
      fat: row.fat,
      fiber: row.fiber,
    });
  }

  // Regenerating a week replaces its items, which orphans any completion
  // rows already written for it -- the plan link above no longer knows
  // them. A row that carries a library recipe's exact name in "serving"
  // units is that kind of row, not something the person typed.
  const candidates = Array.from(byFood.values());
  const servingNamed = candidates.filter((f) => f.unit === "serving").map((f) => f.food);
  const recipeNames = new Set<string>();
  if (servingNamed.length > 0) {
    const { data: recipes } = await supabase.from("recipes").select("name").in("name", servingNamed);
    for (const r of recipes ?? []) recipeNames.add(r.name.toLowerCase());
  }

  const favorites = candidates
    .filter((f) => !(f.unit === "serving" && recipeNames.has(f.food.toLowerCase())))
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_FAVORITES);

  return NextResponse.json({ favorites });
}
