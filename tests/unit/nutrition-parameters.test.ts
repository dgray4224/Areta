import { describe, expect, it } from "vitest";
import { calculateNutritionParameters } from "@/domains/parameters/nutrition-calc";

function findParam(params: ReturnType<typeof calculateNutritionParameters>["parameters"], id: string) {
  const p = params.find((x) => x.id === id);
  if (!p) throw new Error(`Missing parameter ${id}`);
  return p;
}

describe("calculateNutritionParameters", () => {
  it("returns no parameters when current weight is missing", () => {
    const result = calculateNutritionParameters({ units: "imperial" });
    expect(result.parameters).toHaveLength(0);
    expect(result.missingInputs).toContain("current weight");
  });

  it("computes a full set of parameters for a complete loss profile", () => {
    const result = calculateNutritionParameters({
      units: "imperial",
      height: 69,
      currentWeight: 220,
      targetWeight: 200,
      age: 31,
      sex: "male",
      activityLevel: "moderate",
      targetDate: "2026-12-01",
      today: "2026-07-28",
      trackingPreference: "simple",
    });

    expect(result.missingInputs).toHaveLength(0);
    const maintenance = findParam(result.parameters, "maintenance_calories");
    expect(maintenance.value).toBeGreaterThan(1800);
    expect(maintenance.value).toBeLessThan(3200);

    const calorieTarget = findParam(result.parameters, "calorie_target");
    expect(calorieTarget.value as number).toBeLessThan(maintenance.value as number);

    const protein = findParam(result.parameters, "protein_target_g");
    expect(protein.value).toBe(Math.round(220 * 0.8));

    const rate = findParam(result.parameters, "expected_weekly_rate_lb");
    expect(rate.value).toBeGreaterThan(0);
  });

  it("treats current and target weight within 0.5lb as maintenance", () => {
    const result = calculateNutritionParameters({
      units: "imperial",
      height: 69,
      currentWeight: 180,
      targetWeight: 180,
      age: 30,
      sex: "female",
      activityLevel: "sedentary",
      today: "2026-07-28",
    });

    const rate = findParam(result.parameters, "expected_weekly_rate_lb");
    expect(rate.value).toBe(0);
    const calorieTarget = findParam(result.parameters, "calorie_target");
    const maintenance = findParam(result.parameters, "maintenance_calories");
    expect(calorieTarget.value).toBe(maintenance.value);
  });

  it("caps an unsafe required weekly rate and flags it", () => {
    const result = calculateNutritionParameters({
      units: "imperial",
      height: 65,
      currentWeight: 200,
      targetWeight: 150,
      age: 28,
      sex: "female",
      activityLevel: "sedentary",
      targetDate: "2026-08-15", // ~2.5 weeks — wildly aggressive for 50lb
      today: "2026-07-28",
    });

    const rate = findParam(result.parameters, "expected_weekly_rate_lb");
    expect(rate.value as number).toBeLessThanOrEqual(2);
    const calorieTarget = findParam(result.parameters, "calorie_target");
    expect(calorieTarget.safetyBounds?.length ?? 0).toBeGreaterThan(0);
    expect(calorieTarget.requiresProfessionalApproval).toBe(true);
  });

  it("never sets the calorie target below the safety floor", () => {
    const result = calculateNutritionParameters({
      units: "imperial",
      height: 60,
      currentWeight: 110,
      targetWeight: 90,
      age: 25,
      sex: "female",
      activityLevel: "sedentary",
      targetDate: "2026-09-01",
      today: "2026-07-28",
    });

    const calorieTarget = findParam(result.parameters, "calorie_target");
    expect(calorieTarget.value as number).toBeGreaterThanOrEqual(1200);
  });

  it("honors a user-provided protein override instead of calculating one", () => {
    const result = calculateNutritionParameters({
      units: "imperial",
      height: 69,
      currentWeight: 220,
      targetWeight: 200,
      age: 31,
      proteinTargetGramsOverride: 170,
      today: "2026-07-28",
    });

    const protein = findParam(result.parameters, "protein_target_g");
    expect(protein.value).toBe(170);
    expect(protein.source).toBe("rule");
  });

  it("records assumptions and lowers confidence when inputs are missing", () => {
    const result = calculateNutritionParameters({
      units: "imperial",
      currentWeight: 220,
      today: "2026-07-28",
    });

    expect(result.missingInputs).toEqual(expect.arrayContaining(["height", "age"]));
    const maintenance = findParam(result.parameters, "maintenance_calories");
    expect(maintenance.assumptions.length).toBeGreaterThan(0);
    expect(maintenance.confidence).toBeLessThan(0.85);
  });

  it("converts metric inputs correctly relative to an equivalent imperial profile", () => {
    const imperial = calculateNutritionParameters({
      units: "imperial",
      height: 69,
      currentWeight: 220,
      targetWeight: 200,
      age: 31,
      sex: "male",
      activityLevel: "moderate",
      today: "2026-07-28",
    });
    const metric = calculateNutritionParameters({
      units: "metric",
      height: 175.26, // 69in in cm
      currentWeight: 99.79, // 220lb in kg
      targetWeight: 90.72, // 200lb in kg
      age: 31,
      sex: "male",
      activityLevel: "moderate",
      today: "2026-07-28",
    });

    const imperialMaintenance = findParam(imperial.parameters, "maintenance_calories").value as number;
    const metricMaintenance = findParam(metric.parameters, "maintenance_calories").value as number;
    expect(Math.abs(imperialMaintenance - metricMaintenance)).toBeLessThanOrEqual(2);
  });
});
