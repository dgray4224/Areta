"use server";

import { createClient } from "@/platform/supabase/server";
import type { ActionResult } from "@/platform/auth/actions";
import { calculateNutritionParameters } from "@/domains/parameters/nutrition-calc";
import type { NutritionInput } from "@/domains/nutrition/schema";
import type { GeneratedParameter } from "@/domains/parameters/types";

/** Display order for the parameters engine emits, since Supabase doesn't
 * preserve insertion order across separate rows. */
const NUTRITION_PARAMETER_ORDER = [
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
];

export type StoredParameter = GeneratedParameter & {
  dbId: string;
  approved: boolean;
  approvedAt: string | null;
};

/**
 * Recomputes nutrition parameters from the user's onboarding answers +
 * profile and stores them as pending (unapproved) proposals — regenerating
 * always resets approval per CLAUDE.md rule 24, even on a recalculation.
 */
export async function generateNutritionParameters(userId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const [{ data: profile }, { data: responses }, { data: domain }] = await Promise.all([
    supabase.from("profiles").select("units").eq("id", userId).single(),
    supabase.from("onboarding_responses").select("nutrition").eq("user_id", userId).single(),
    supabase.from("domains").select("id").eq("user_id", userId).eq("key", "nutrition").single(),
  ]);

  const nutrition = (responses?.nutrition ?? {}) as NutritionInput;

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

  const { parameters, missingInputs } = calculateNutritionParameters({
    units: (profile?.units as "metric" | "imperial") ?? "imperial",
    height: nutrition.height,
    currentWeight: nutrition.currentWeight,
    targetWeight: nutrition.targetWeight,
    age: nutrition.age,
    sex: nutrition.sex,
    activityLevel: nutrition.activityLevel,
    targetDate,
    trackingPreference: nutrition.trackingPreference,
    proteinTargetGramsOverride: nutrition.proteinTargetGrams,
  });

  if (parameters.length === 0) {
    return {
      ok: false,
      error: `Add ${missingInputs.join(" and ")} in onboarding before LifeOS can calculate nutrition targets.`,
    };
  }

  const { error } = await supabase.from("generated_parameters").upsert(
    parameters.map((param) => ({
      user_id: userId,
      domain: param.domain,
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
    return { ok: false, error: `Failed to save nutrition parameters: ${error.message}` };
  }

  return { ok: true, data: undefined };
}

export async function getNutritionParameters(userId: string): Promise<StoredParameter[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("generated_parameters")
    .select("*")
    .eq("user_id", userId)
    .eq("domain", "nutrition");

  if (error) {
    throw new Error(`Failed to load nutrition parameters: ${error.message}`);
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

  return rows.sort(
    (a, b) => NUTRITION_PARAMETER_ORDER.indexOf(a.id) - NUTRITION_PARAMETER_ORDER.indexOf(b.id)
  );
}

/** Approves the current set of nutrition parameters, applying any
 * user-edited values first (CLAUDE.md: "The user may edit or reject any
 * generated parameter"). `edits` maps parameter name -> new raw value. */
export async function approveNutritionParameters(
  userId: string,
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
        .eq("domain", "nutrition")
        .eq("name", name)
    )
  );

  const failed = results.find((r) => r.error);
  if (failed?.error) {
    return { ok: false, error: `Failed to approve nutrition parameters: ${failed.error.message}` };
  }

  return { ok: true, data: undefined };
}

export async function getApprovedNutritionValue(
  userId: string,
  name: string
): Promise<number | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("generated_parameters")
    .select("value, approved")
    .eq("user_id", userId)
    .eq("domain", "nutrition")
    .eq("name", name)
    .eq("approved", true)
    .maybeSingle();

  if (!data) return null;
  const value = data.value;
  return typeof value === "number" ? value : null;
}
