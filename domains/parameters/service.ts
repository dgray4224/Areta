"use server";

import { createClient } from "@/platform/supabase/server";
import type { ActionResult } from "@/platform/auth/actions";
import {
  calculateNutritionParameters,
  type NutritionParameterInputs,
} from "@/domains/parameters/nutrition-calc";
import { calculateExerciseParameters } from "@/domains/parameters/exercise-calc";
import { calculateGoalFirstExerciseParameters } from "@/domains/parameters/exercise-calc-goalfirst";
import type { ExerciseInput } from "@/domains/exercise/schema";
import type { NutritionInput } from "@/domains/nutrition/schema";
import { isLegacyExerciseShape } from "@/domains/exercise/legacy";
import type { GeneratedParameter } from "@/domains/parameters/types";

/** Display order per domain, since Supabase doesn't preserve insertion
 * order across separate rows. Domains not listed here fall back to
 * whatever order the DB returns. */
const PARAMETER_ORDER: Record<string, string[]> = {
  nutrition: [
    "maintenance_calories",
    "calorie_target",
    "protein_target_g",
    "fat_minimum_g",
    "carbohydrate_range_g",
    "fiber_target_g",
    "hydration_target_oz",
    "expected_weekly_rate_lb",
    "weigh_in_cadence",
    "adjustment_threshold",
  ],
  exercise: [
    "sessions_per_week",
    "phase_structure",
    "phase_length_weeks",
    "weekly_progression_cap_pct",
    "deload_frequency_weeks",
    "primary_focus",
  ],
};

export type StoredParameter = GeneratedParameter & {
  dbId: string;
  approved: boolean;
  approvedAt: string | null;
};

const LB_PER_KG = 2.2046226218;

/** Converts a logged weight (lb or kg) to the unit system a profile uses
 * (imperial -> lb, metric -> kg), so it can substitute directly for the
 * onboarding-entered current weight. */
function convertLoggedWeight(weight: number, loggedUnit: "lb" | "kg", targetUnits: "metric" | "imperial"): number {
  const wantsLb = targetUnits === "imperial";
  if (wantsLb === (loggedUnit === "lb")) return weight;
  return wantsLb ? weight * LB_PER_KG : weight / LB_PER_KG;
}

/** Shared write path for every domain's generated parameters — writing
 * always resets approval (CLAUDE.md rule 24), even on a recalculation. */
async function writeGeneratedParameters(
  userId: string,
  domain: string,
  parameters: GeneratedParameter[]
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("generated_parameters").upsert(
    parameters.map((param) => ({
      user_id: userId,
      domain,
      name: param.id,
      value: param.value,
      unit: param.unit ?? null,
      range_min: param.range?.min ?? null,
      range_max: param.range?.max ?? null,
      source: param.source,
      assumptions: param.assumptions,
      rationale: param.rationale,
      confidence: param.confidence,
      safety_bounds: param.safetyBounds ?? [],
      review_date: param.reviewDate ?? null,
      requires_user_approval: param.requiresUserApproval,
      requires_professional_approval: param.requiresProfessionalApproval ?? false,
      approved: false,
      approved_at: null,
    })),
    { onConflict: "user_id,domain,name" }
  );
  if (error) {
    return { ok: false, error: `Failed to save ${domain} parameters: ${error.message}` };
  }
  return { ok: true, data: undefined };
}

export type NutritionCalculationBaseInputs = Omit<NutritionParameterInputs, "targetDate" | "today">;

/**
 * Gathers the client-profile inputs calculateNutritionParameters needs --
 * onboarding nutrition answers, profile units, and the most recent logged
 * weight in preference over the static onboarding value (same
 * observed-outcomes-over-static-estimate reasoning as
 * generateNutritionParameters below) -- without deciding targetDate/today.
 * Factored out so a caller can supply its own date scoping:
 * generateNutritionParameters uses the client's own goal's target_date;
 * domains/trainer/service.ts#previewEngagementNutritionTargets uses a
 * trainer assignment's own starts_on/end_date instead (2026-08-07, a
 * trainer's engagement window often doesn't match the client's own
 * long-range goal timeline).
 */
export async function getNutritionCalculationBaseInputs(
  userId: string
): Promise<NutritionCalculationBaseInputs> {
  const supabase = await createClient();

  const [{ data: profile }, { data: responses }, { data: latestWeightLog }] = await Promise.all([
    supabase.from("profiles").select("units").eq("id", userId).single(),
    supabase.from("onboarding_responses").select("nutrition").eq("user_id", userId).single(),
    supabase
      .from("health_metrics")
      .select("value, unit, started_at")
      .eq("user_id", userId)
      .eq("metric_type", "weight")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const nutrition = (responses?.nutrition ?? {}) as NutritionInput;
  const units = (profile?.units as "metric" | "imperial") ?? "imperial";
  const currentWeight = latestWeightLog
    ? convertLoggedWeight(Number(latestWeightLog.value), latestWeightLog.unit as "lb" | "kg", units)
    : nutrition.currentWeight;

  return {
    units,
    height: nutrition.height,
    currentWeight,
    targetWeight: nutrition.targetWeight,
    age: nutrition.age,
    sex: nutrition.sex,
    activityLevel: nutrition.activityLevel,
    trackingPreference: nutrition.trackingPreference,
    proteinTargetGramsOverride: nutrition.proteinTargetGrams,
  };
}

/**
 * Recomputes nutrition parameters from the user's most recent logged
 * weight (falling back to the onboarding-entered value if nothing has been
 * logged yet) plus onboarding answers and profile, and stores them as
 * pending (unapproved) proposals. Preferring the logged weight over the
 * static onboarding value is what makes this a *recalculation from
 * observed outcomes* (rule 23) rather than a one-time estimate.
 */
export async function generateNutritionParameters(userId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const baseInputs = await getNutritionCalculationBaseInputs(userId);

  const { data: domain } = await supabase
    .from("domains")
    .select("id")
    .eq("user_id", userId)
    .eq("key", "nutrition")
    .single();

  let targetDate: string | undefined;
  if (domain?.id) {
    const { data: goal } = await supabase
      .from("goals")
      .select("target_date")
      .eq("user_id", userId)
      .eq("domain_id", domain.id)
      .order("priority", { ascending: true })
      .limit(1)
      .maybeSingle();
    targetDate = goal?.target_date ?? undefined;
  }

  const { parameters, missingInputs } = calculateNutritionParameters({ ...baseInputs, targetDate });

  if (parameters.length === 0) {
    return {
      ok: false,
      error: `Add ${missingInputs.join(" and ")} in onboarding before Areta can calculate nutrition targets.`,
    };
  }

  return writeGeneratedParameters(userId, "nutrition", parameters);
}

/** Recomputes exercise parameters from the Exercise onboarding step's
 * answers. Unlike nutrition, there's no logged-data override yet — phase
 * length/archetype are direct stated inputs, not derived from a trend. */
export async function generateExerciseParameters(userId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: responses } = await supabase
    .from("onboarding_responses")
    .select("exercise")
    .eq("user_id", userId)
    .single();

  const exercise = responses?.exercise ?? {};
  // Two calculators, one output contract (same six parameter ids):
  // legacy archetype-shape users keep the original calculator; everyone
  // onboarded through the current goal-first Exercise step goes through
  // the goal-first one (2026-08-07 -- this closed the "coming soon" gap
  // where new-shape users could never generate parameters at all).
  const { parameters, missingInputs } = isLegacyExerciseShape(exercise)
    ? calculateExerciseParameters({
        archetype: exercise.archetype,
        experienceLevel: exercise.experienceLevel,
        trainingPhaseLengthWeeks: exercise.trainingPhaseLengthWeeks,
        daysPerWeekAvailable: exercise.daysPerWeekAvailable,
        sessionLengthMinutesAvailable: exercise.sessionLengthMinutesAvailable,
      })
    : calculateGoalFirstExerciseParameters(exercise as ExerciseInput);

  if (parameters.length === 0) {
    return {
      ok: false,
      error: `Add ${missingInputs.join(" and ")} in onboarding before Areta can build your training parameters.`,
    };
  }

  return writeGeneratedParameters(userId, "exercise", parameters);
}

export async function getGeneratedParameters(userId: string, domain: string): Promise<StoredParameter[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("generated_parameters")
    .select("*")
    .eq("user_id", userId)
    .eq("domain", domain);

  if (error) {
    throw new Error(`Failed to load ${domain} parameters: ${error.message}`);
  }

  const rows = (data ?? []).map(
    (row): StoredParameter => ({
      dbId: row.id,
      domain: row.domain,
      id: row.name,
      name: row.name,
      value: row.value as GeneratedParameter["value"],
      unit: row.unit ?? undefined,
      range:
        row.range_min !== null && row.range_max !== null
          ? { min: row.range_min, max: row.range_max }
          : undefined,
      source: row.source as GeneratedParameter["source"],
      assumptions: row.assumptions,
      rationale: row.rationale,
      confidence: row.confidence,
      safetyBounds: row.safety_bounds.length > 0 ? row.safety_bounds : undefined,
      reviewDate: row.review_date ?? undefined,
      requiresUserApproval: row.requires_user_approval,
      requiresProfessionalApproval: row.requires_professional_approval,
      approved: row.approved,
      approvedAt: row.approved_at,
    })
  );

  const order = PARAMETER_ORDER[domain] ?? [];
  return rows.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}

/** Approves the current set of a domain's parameters, applying any
 * user-edited values first (CLAUDE.md: "The user may edit or reject any
 * generated parameter"). `edits` maps parameter name -> new raw value. */
export async function approveGeneratedParameters(
  userId: string,
  domain: string,
  edits: Record<string, string | number>
): Promise<ActionResult> {
  const supabase = await createClient();
  const approvedAt = new Date().toISOString();

  const results = await Promise.all(
    Object.entries(edits).map(([name, value]) =>
      supabase
        .from("generated_parameters")
        .update({ value, approved: true, approved_at: approvedAt })
        .eq("user_id", userId)
        .eq("domain", domain)
        .eq("name", name)
    )
  );

  const failed = results.find((r) => r.error);
  if (failed?.error) {
    return { ok: false, error: `Failed to approve ${domain} parameters: ${failed.error.message}` };
  }

  return { ok: true, data: undefined };
}

/** Approves all currently-generated parameters for a domain as-is, without
 * per-field edits — used by weekly regeneration, where the user approves
 * the week's plan as a bundle rather than re-reviewing every number. */
export async function approveAllGeneratedParameters(userId: string, domain: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("generated_parameters")
    .update({ approved: true, approved_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("domain", domain);

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: undefined };
}

export async function getApprovedParameterValue(
  userId: string,
  domain: string,
  name: string
): Promise<number | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("generated_parameters")
    .select("value, approved")
    .eq("user_id", userId)
    .eq("domain", domain)
    .eq("name", name)
    .eq("approved", true)
    .maybeSingle();

  if (!data) return null;
  const value = data.value;
  return typeof value === "number" ? value : null;
}
