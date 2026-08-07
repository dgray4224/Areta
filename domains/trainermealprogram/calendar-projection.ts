import type { HydratedTrainerMealProgramPhase, MealType } from "@/domains/trainermealprogram/types";

/** Pure date helpers, self-contained rather than imported from
 * domains/trainerprogram/calendar-projection.ts -- same reasoning as
 * phase-resolution.ts's own comment: keeps this domain's calendar module
 * free of a cross-domain dependency, even though the arithmetic is
 * identical. */
function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toIsoDate(d);
}

export function sundayOfWeekContaining(isoDate: string): string {
  const dow = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  return addDays(isoDate, -dow);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00Z`).getTime();
  const to = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

function dayOfWeekOf(isoDate: string): number {
  return new Date(`${isoDate}T00:00:00Z`).getUTCDay();
}

export type ProjectedMeal = {
  mealType: MealType;
  recipeId: string;
  /** Non-null only for an override-sourced meal -- the trainer sets an
   * explicit quantity when creating one (migration 0085's own comment:
   * no single day-of-week template row to recommend a portion against).
   * Null for a template-sourced meal; final servings get resolved by the
   * materializer from saved/recommended portions
   * (domains/trainermealprogram/portions.ts), same as before this
   * calendar existed -- a pure projection has no calorie-target input to
   * compute a recommendation from. */
  servings: number | null;
  /** Non-null only for a template-sourced meal -- lets the materializer
   * set meal_plan_items.trainer_meal_program_meal_id (traceability, and
   * the key portions.ts looks recommendations up by). Null for an
   * override (no single upstream row it came from), matching the
   * workout side's own sourceSessionExerciseId convention exactly. */
  sourceMealId: string | null;
};

export type ProjectedMealDay = {
  date: string;
  dayOfWeek: number;
  /** Mirrors domains/trainerprogram/calendar-projection.ts#ProjectedDay's
   * own source union -- see that type's doc comment for what each value
   * means; "no_meals" here is the nutrition-side name for what that
   * module calls "rest" (no session authored for this day-of-week). */
  source: "not_started" | "ended" | "phases_complete" | "override" | "template" | "no_meals";
  phaseId: string | null;
  phaseName: string | null;
  weekInPhase: number | null;
  meals: ProjectedMeal[];
};

export type MealDateOverrideInput = {
  isNoProgramDay: boolean;
  meals: ProjectedMeal[];
};

/** Same core loop as domains/trainermealprogram/phase-resolution.ts's
 * resolveMealProgramPhase, duplicated rather than imported: that module
 * takes `today` as a single point and has no notion of a date *range*,
 * while this one is called once per date inside projectMealProgramRange
 * below and needs the phase objects themselves (not just their id/name/
 * lengthWeeks), so the two aren't quite interchangeable without an
 * awkward adapter either way. Both must stay in sync if the phase-
 * resolution rule ever changes. */
function resolvePhaseForDate(
  date: string,
  startsOn: string,
  phases: HydratedTrainerMealProgramPhase[]
): { phase: HydratedTrainerMealProgramPhase; weekInPhase: number } | null {
  if (phases.length === 0) return null;
  if (date < startsOn) return null;

  const weeksSinceStart = Math.floor(daysBetween(startsOn, date) / 7);
  const totalCycleWeeks = phases.reduce((sum, p) => sum + p.lengthWeeks, 0);
  if (totalCycleWeeks <= 0) return null;
  if (weeksSinceStart >= totalCycleWeeks) return null;

  let remaining = weeksSinceStart;
  for (const phase of phases) {
    if (remaining < phase.lengthWeeks) {
      return { phase, weekInPhase: remaining + 1 };
    }
    remaining -= phase.lengthWeeks;
  }
  const last = phases[phases.length - 1];
  return { phase: last, weekInPhase: last.lengthWeeks };
}

/**
 * Projects a date range into a day-by-day meal schedule -- nutrition-side
 * mirror of domains/trainerprogram/calendar-projection.ts#projectProgramRange.
 * The single function both the calendar UI and the real weekly
 * materializer call, so what a trainer sees on the calendar can never be
 * out of sync with what actually lands in the client's plan.
 */
export function projectMealProgramRange(input: {
  startsOn: string;
  endDate?: string | null;
  /** Sorted by phaseOrder ascending. */
  phases: HydratedTrainerMealProgramPhase[];
  rangeStart: string;
  rangeEnd: string;
  overridesByDate: Map<string, MealDateOverrideInput>;
}): ProjectedMealDay[] {
  const { startsOn, endDate, phases, rangeStart, rangeEnd, overridesByDate } = input;
  const days: ProjectedMealDay[] = [];

  const dayCount = daysBetween(rangeStart, rangeEnd) + 1;
  for (let i = 0; i < dayCount; i++) {
    const date = addDays(rangeStart, i);
    const dayOfWeek = dayOfWeekOf(date);

    if (endDate && date > endDate) {
      days.push({ date, dayOfWeek, source: "ended", phaseId: null, phaseName: null, weekInPhase: null, meals: [] });
      continue;
    }

    const override = overridesByDate.get(date);
    const resolved = resolvePhaseForDate(date, startsOn, phases);

    if (override) {
      days.push({
        date,
        dayOfWeek,
        source: "override",
        phaseId: resolved?.phase.id ?? null,
        phaseName: resolved?.phase.name ?? null,
        weekInPhase: resolved?.weekInPhase ?? null,
        meals: override.isNoProgramDay ? [] : override.meals,
      });
      continue;
    }

    if (!resolved) {
      days.push({
        date,
        dayOfWeek,
        source: date < startsOn ? "not_started" : "phases_complete",
        phaseId: null,
        phaseName: null,
        weekInPhase: null,
        meals: [],
      });
      continue;
    }

    const dayMeals = resolved.phase.meals.filter((m) => m.dayOfWeek === dayOfWeek).sort((a, b) => a.mealOrder - b.mealOrder);
    if (dayMeals.length === 0) {
      days.push({
        date,
        dayOfWeek,
        source: "no_meals",
        phaseId: resolved.phase.id,
        phaseName: resolved.phase.name,
        weekInPhase: resolved.weekInPhase,
        meals: [],
      });
      continue;
    }

    days.push({
      date,
      dayOfWeek,
      source: "template",
      phaseId: resolved.phase.id,
      phaseName: resolved.phase.name,
      weekInPhase: resolved.weekInPhase,
      meals: dayMeals.map((m) => ({
        mealType: m.mealType,
        recipeId: m.recipeId,
        servings: null,
        sourceMealId: m.id,
      })),
    });
  }

  return days;
}
