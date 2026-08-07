/**
 * Deterministic starting-point portion size for a trainer-authored meal,
 * given a client's own approved daily calorie target (CLAUDE.md rule 6:
 * deterministic code for calculations, never AI). Not a final answer --
 * the trainer reviews and hand-tailors every value before saving (see
 * domains/trainer/service.ts#saveMealPortions); this only has to get
 * them a reasonable place to start from, same spirit as
 * domains/mealplan/generate.ts's per-slot target split.
 *
 * The day's calorie target is split evenly across however many meal
 * slots that day actually has (breakfast/lunch/dinner/snack -- whatever
 * the trainer authored), then the recommended servings multiplier is
 * whatever makes this one recipe's calories land on that per-slot share.
 * Deliberately calorie-only, not also protein -- a single servings
 * multiplier scales a recipe's whole nutritional profile at once, so it
 * can't hit two independent targets simultaneously unless the recipe's
 * own macro ratio already happens to match. Calorie total is the more
 * load-bearing number for the outcomes this exists to serve (lose
 * weight / gain muscle / maintain), and the trainer sees the resulting
 * protein contribution right alongside this number to judge for
 * themselves whether to override it.
 */
export function recommendServings(dailyCalorieTarget: number, mealSlotsThisDay: number, recipeCalories: number): number {
  if (dailyCalorieTarget <= 0 || mealSlotsThisDay <= 0 || recipeCalories <= 0) return 1;
  const perSlotTarget = dailyCalorieTarget / mealSlotsThisDay;
  const raw = perSlotTarget / recipeCalories;
  // Nearest quarter-serving -- finer than that isn't realistically
  // measurable/followable, coarser loses too much precision against the
  // target.
  const rounded = Math.round(raw * 4) / 4;
  // Sanity bounds: below a quarter serving isn't a real meal, and above
  // 4x a recipe's authored serving size almost always means the wrong
  // recipe was picked for this slot, not that portions should be huge.
  return Math.min(4, Math.max(0.25, rounded));
}
