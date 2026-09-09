/**
 * The two-tap off-plan log: "I ate out -- light / normal / big". The
 * person never types a meal; the entry is a rough share of their own
 * daily targets, stored deliberately low-precision (calories to the
 * nearest 50, protein to the nearest 5) so it never reads as measured.
 *
 * Shared by the mobile client (mirrored in lib/nutrition/quickLog.ts --
 * keep in sync) and the favourites endpoint, which uses the note to keep
 * these vague rows from hardening into "favourites".
 */
export const QUICK_ESTIMATE_NOTE = "Rough estimate from your daily targets";

export const QUICK_BANDS = ["light", "normal", "big"] as const;
export type QuickBand = (typeof QUICK_BANDS)[number];

/** Share of the day's targets each band represents. A normal meal is a
 * third of the day; light is a small plate; big is the kind of dinner
 * out that IS most of the day. */
export const QUICK_BAND_SHARE: Record<QuickBand, number> = { light: 0.2, normal: 0.35, big: 0.5 };
export const QUICK_BAND_LABEL: Record<QuickBand, string> = { light: "Light", normal: "Normal", big: "Big" };

/** Used when the person has no approved targets yet (onboarding not
 * finished, training-only account): a plain adult-maintenance day. */
export const FALLBACK_CALORIE_TARGET = 2000;
export const FALLBACK_PROTEIN_TARGET = 120;

export function quickEstimate(
  band: QuickBand,
  targets: { calories: number | null; protein: number | null }
): { food: string; calories: number; protein: number; notes: string } {
  const share = QUICK_BAND_SHARE[band];
  const calorieTarget = targets.calories ?? FALLBACK_CALORIE_TARGET;
  const proteinTarget = targets.protein ?? FALLBACK_PROTEIN_TARGET;
  return {
    food: `Ate out (${band})`,
    calories: Math.max(50, Math.round((calorieTarget * share) / 50) * 50),
    protein: Math.max(5, Math.round((proteinTarget * share) / 5) * 5),
    notes: QUICK_ESTIMATE_NOTE,
  };
}
