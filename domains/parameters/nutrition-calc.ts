import type { ActivityLevel } from "@/domains/nutrition/schema";
import type { GeneratedParameter } from "@/domains/parameters/types";

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const LB_PER_KG = 2.2046226218;
const IN_PER_CM = 1 / 2.54;
const KCAL_PER_LB_FAT = 3500;
const SAFE_MAX_WEEKLY_LOSS_LB = 2;
const SAFE_MAX_WEEKLY_GAIN_LB = 1;
const CALORIE_FLOOR_MALE = 1500;
const CALORIE_FLOOR_FEMALE_OR_UNKNOWN = 1200;

export type NutritionParameterInputs = {
  units: "metric" | "imperial";
  /** Inches if imperial, cm if metric — matches the onboarding form. */
  height?: number;
  /** lb if imperial, kg if metric. */
  currentWeight?: number;
  targetWeight?: number;
  age?: number;
  sex?: "male" | "female";
  activityLevel?: ActivityLevel;
  /** ISO date the user wants to hit targetWeight by, if any. */
  targetDate?: string;
  /** Injectable for deterministic tests; defaults to now. */
  today?: string;
  trackingPreference?: "detailed" | "simple" | "none";
  /** If the user already knows their protein target, honor it directly
   * rather than asking them to re-derive it (CLAUDE.md rule 21). */
  proteinTargetGramsOverride?: number;
};

export type NutritionParameterResult = {
  parameters: GeneratedParameter[];
  /** Human-readable list of onboarding fields still needed for a full
   * calculation, e.g. ["height", "current weight"]. Empty when complete. */
  missingInputs: string[];
};

function toKg(weight: number, units: "metric" | "imperial"): number {
  return units === "imperial" ? weight / LB_PER_KG : weight;
}

function toCm(height: number, units: "metric" | "imperial"): number {
  return units === "imperial" ? height / IN_PER_CM : height;
}

function toLb(kg: number): number {
  return kg * LB_PER_KG;
}

function weeksBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  return Math.max((to - from) / (1000 * 60 * 60 * 24 * 7), 0.1);
}

/**
 * Deterministic Outcome-to-Operating-Parameters engine for nutrition
 * (CLAUDE.md §5A). Pure and side-effect free so it's fully unit-testable;
 * persistence and approval live in service.ts.
 */
export function calculateNutritionParameters(
  inputs: NutritionParameterInputs
): NutritionParameterResult {
  const missingInputs: string[] = [];
  if (!inputs.currentWeight) missingInputs.push("current weight");
  if (!inputs.height) missingInputs.push("height");
  if (!inputs.age) missingInputs.push("age");

  if (!inputs.currentWeight) {
    // No usable baseline at all — nothing responsible to generate.
    return { parameters: [], missingInputs };
  }

  const today = inputs.today ?? new Date().toISOString().slice(0, 10);
  const currentWeightKg = toKg(inputs.currentWeight, inputs.units);
  const currentWeightLb = toLb(currentWeightKg);
  const targetWeightLb = inputs.targetWeight
    ? toLb(toKg(inputs.targetWeight, inputs.units))
    : currentWeightLb;

  const assumptions: string[] = [];

  // --- BMR (Mifflin-St Jeor) ---
  const heightCm = inputs.height ? toCm(inputs.height, inputs.units) : 170;
  if (!inputs.height) assumptions.push("Height not provided — assumed 170cm (5'7\").");
  const age = inputs.age ?? 35;
  if (!inputs.age) assumptions.push("Age not provided — assumed 35.");
  const sexConstant = inputs.sex === "male" ? 5 : inputs.sex === "female" ? -161 : -78;
  if (!inputs.sex) {
    assumptions.push(
      "Sex not provided — used the midpoint of the male/female Mifflin-St Jeor constants."
    );
  }
  const bmr = 10 * currentWeightKg + 6.25 * heightCm - 5 * age + sexConstant;

  const activityLevel = inputs.activityLevel ?? "moderate";
  if (!inputs.activityLevel) {
    assumptions.push('Activity level not provided — assumed "moderate".');
  }
  const maintenanceCalories = Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel]);

  // --- Goal direction and pace ---
  const weightDeltaLb = currentWeightLb - targetWeightLb; // positive = losing
  const goalDirection: "loss" | "gain" | "maintain" =
    Math.abs(weightDeltaLb) < 0.5 ? "maintain" : weightDeltaLb > 0 ? "loss" : "gain";

  let weeklyRateLb: number;
  const safetyBounds: string[] = [];
  let requiresProfessionalApproval = false;

  if (goalDirection === "maintain") {
    weeklyRateLb = 0;
  } else if (inputs.targetDate) {
    const weeks = weeksBetween(today, inputs.targetDate);
    const requiredRate = Math.abs(weightDeltaLb) / weeks;
    const safeMax = goalDirection === "loss" ? SAFE_MAX_WEEKLY_LOSS_LB : SAFE_MAX_WEEKLY_GAIN_LB;
    if (requiredRate > safeMax) {
      weeklyRateLb = safeMax;
      safetyBounds.push(
        `Target date implies ${requiredRate.toFixed(1)} lb/week, above the ${safeMax} lb/week safe limit — capped at ${safeMax} lb/week. The target date will likely need to move.`
      );
      if (requiredRate > safeMax * 1.5) {
        requiresProfessionalApproval = true;
      }
    } else {
      weeklyRateLb = requiredRate;
    }
  } else {
    weeklyRateLb = goalDirection === "loss" ? 0.75 : 0.25;
    assumptions.push(
      `No target date provided — assumed a moderate ${weeklyRateLb} lb/week pace.`
    );
  }

  const dailyCalorieAdjustment = (weeklyRateLb * KCAL_PER_LB_FAT) / 7;
  let calorieTarget =
    goalDirection === "loss"
      ? maintenanceCalories - dailyCalorieAdjustment
      : goalDirection === "gain"
        ? maintenanceCalories + dailyCalorieAdjustment
        : maintenanceCalories;

  const calorieFloor =
    inputs.sex === "male" ? CALORIE_FLOOR_MALE : CALORIE_FLOOR_FEMALE_OR_UNKNOWN;
  if (goalDirection === "loss" && calorieTarget < calorieFloor) {
    calorieTarget = calorieFloor;
    safetyBounds.push(
      `Calculated deficit would go below a safe floor (${calorieFloor} kcal/day) — capped there instead. Recommend confirming with a healthcare provider before going lower.`
    );
    requiresProfessionalApproval = true;
  }
  calorieTarget = Math.round(calorieTarget);

  // --- Protein ---
  let proteinGrams: number;
  let proteinSource: GeneratedParameter["source"] = "calculation";
  let proteinRationale: string;
  if (inputs.proteinTargetGramsOverride) {
    proteinGrams = inputs.proteinTargetGramsOverride;
    proteinSource = "rule";
    proteinRationale = "You provided this target directly during onboarding.";
  } else {
    const proteinPerLb = goalDirection === "loss" ? 0.8 : goalDirection === "gain" ? 0.9 : 0.7;
    proteinGrams = Math.round(
      Math.min(Math.max(currentWeightLb * proteinPerLb, 80), 250)
    );
    proteinRationale = `${proteinPerLb}g protein per lb of current bodyweight, within the typical 0.7-1g/lb range for your goal direction (${goalDirection}).`;
  }

  // --- Fat / carbs / fiber / hydration ---
  const fatMinimumGrams = Math.round(Math.max(currentWeightLb * 0.3, 40));
  const proteinCalories = proteinGrams * 4;
  const fatCalories = fatMinimumGrams * 9;
  const remainingCalories = Math.max(calorieTarget - proteinCalories - fatCalories, 0);
  const carbGramsMid = Math.round(remainingCalories / 4);
  const carbRange = {
    min: Math.max(Math.round(carbGramsMid * 0.85), 0),
    max: Math.round(carbGramsMid * 1.15),
  };
  const fiberGrams = Math.round((calorieTarget / 1000) * 14);
  const hydrationOz = Math.round(currentWeightLb / 2);

  const weighInCadence =
    inputs.trackingPreference === "none"
      ? "weekly"
      : inputs.trackingPreference === "detailed"
        ? "daily"
        : "3x per week";

  const reviewDate = new Date(today);
  reviewDate.setDate(reviewDate.getDate() + 14);
  const reviewDateIso = reviewDate.toISOString().slice(0, 10);

  const confidence = missingInputs.length === 0 ? 0.85 : Math.max(0.85 - missingInputs.length * 0.15, 0.4);

  const base = {
    domain: "nutrition",
    source: "calculation" as const,
    assumptions,
    confidence,
    safetyBounds: safetyBounds.length > 0 ? safetyBounds : undefined,
    reviewDate: reviewDateIso,
    requiresUserApproval: true,
    requiresProfessionalApproval: requiresProfessionalApproval || undefined,
  };

  const parameters: GeneratedParameter[] = [
    {
      ...base,
      id: "maintenance_calories",
      name: "Maintenance calories",
      value: maintenanceCalories,
      unit: "kcal/day",
      rationale: `Mifflin-St Jeor BMR (${Math.round(bmr)} kcal) x ${activityLevel} activity multiplier (${ACTIVITY_MULTIPLIERS[activityLevel]}).`,
    },
    {
      ...base,
      id: "calorie_target",
      name: "Initial calorie target",
      value: calorieTarget,
      unit: "kcal/day",
      rationale:
        goalDirection === "maintain"
          ? "Matches maintenance calories since current and target weight are within 0.5 lb."
          : `Maintenance calories ${goalDirection === "loss" ? "minus" : "plus"} a ${weeklyRateLb.toFixed(2)} lb/week pace (${Math.round(dailyCalorieAdjustment)} kcal/day).`,
    },
    {
      ...base,
      id: "protein_target_g",
      name: "Protein target",
      value: proteinGrams,
      unit: "g/day",
      source: proteinSource,
      rationale: proteinRationale,
    },
    {
      ...base,
      id: "fat_minimum_g",
      name: "Fat minimum",
      value: fatMinimumGrams,
      unit: "g/day",
      rationale: "0.3g per lb of current bodyweight, with a 40g floor for hormonal health.",
    },
    {
      ...base,
      id: "carbohydrate_range_g",
      name: "Carbohydrate range",
      value: carbGramsMid,
      unit: "g/day",
      range: carbRange,
      rationale: "Remaining calories after protein and fat, expressed as a ±15% range.",
    },
    {
      ...base,
      id: "fiber_target_g",
      name: "Fiber target",
      value: fiberGrams,
      unit: "g/day",
      rationale: "14g fiber per 1000 kcal, per standard dietary guidelines.",
    },
    {
      ...base,
      id: "hydration_target_oz",
      name: "Hydration target",
      value: hydrationOz,
      unit: "fl oz/day",
      rationale: "Half of current bodyweight (lb) in fluid ounces, a common baseline heuristic.",
    },
    {
      ...base,
      id: "expected_weekly_rate_lb",
      name: "Expected weekly rate of change",
      value: Math.round(weeklyRateLb * 100) / 100,
      unit: "lb/week",
      rationale:
        goalDirection === "maintain"
          ? "Maintaining current weight."
          : inputs.targetDate
            ? "Derived from your target date and the gap between current and target weight, capped at safe limits."
            : "No target date given, so a moderate default pace was assumed.",
    },
    {
      ...base,
      id: "weigh_in_cadence",
      name: "Weigh-in cadence",
      value: weighInCadence,
      source: "rule",
      rationale: `Based on your stated tracking preference (${inputs.trackingPreference ?? "not specified, defaulted to moderate"}).`,
    },
    {
      ...base,
      id: "adjustment_threshold",
      name: "Adjustment threshold",
      value: "Recalculate if your 2-week average trend deviates from the expected rate by more than 0.5 lb/week",
      source: "rule",
      rationale: "A trend deviation this size usually means the calorie target is off, not just noise.",
    },
  ];

  return { parameters, missingInputs };
}
