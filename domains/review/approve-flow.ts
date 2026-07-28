"use server";

import { createClient } from "@/platform/supabase/server";
import type { ActionResult } from "@/platform/auth/actions";
import { reviewWeekStart, todayIso } from "@/domains/review/dates";
import type { WeeklyBrief } from "@/domains/review/brief-schema";
import type { WeeklyReviewAnswers } from "@/domains/review/schema";
import {
  generateNutritionParameters,
  approveAllNutritionParameters,
} from "@/domains/parameters/service";
import { generateAndSaveMealPlan } from "@/domains/mealplan/service";
import { approveMealPlanAndGenerateDownstream } from "@/domains/mealplan/approve-flow";

function splitKeywords(text: string | undefined | null): string[] {
  if (!text) return [];
  return text
    .split(/[,;]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Approving a generated weekly brief is the moment the whole regeneration
 * cycle activates (CLAUDE.md rule 10 + Phase 4's "The user must approve the
 * plan before it becomes active"). This:
 *  1. Records which proposed changes the user accepted vs rejected.
 *  2. Recalculates nutrition parameters from the latest logged weight and
 *     approves them as a bundle (rule 23 — recalculate from outcomes).
 *  3. Regenerates the meal plan for the new week, folding in any meals the
 *     user said should not return, and cascades to grocery + prep.
 *  4. Rolls weekly_outcomes forward using the brief's priorities.
 *  5. Marks the review approved.
 * A failure in nutrition/meal-plan regeneration (e.g. no nutrition goal at
 * all) doesn't block the rest — those steps are best-effort for users who
 * don't have that domain active.
 */
export async function approveWeeklyReview(
  userId: string,
  rejectedRecommendationIds: string[]
): Promise<ActionResult> {
  const weekStart = reviewWeekStart();
  const supabase = await createClient();

  const { data: review } = await supabase
    .from("weekly_reviews")
    .select("id, brief, answers, status")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (!review || !review.brief) {
    return { ok: false, error: "Generate the weekly brief before approving." };
  }
  if (review.status === "approved") {
    return { ok: false, error: "This week's review is already approved." };
  }

  const { data: recommendations } = await supabase
    .from("recommendations")
    .select("id")
    .eq("weekly_review_id", review.id);

  await Promise.all(
    (recommendations ?? []).map((rec) =>
      supabase
        .from("recommendations")
        .update({ accepted: !rejectedRecommendationIds.includes(rec.id) })
        .eq("id", rec.id)
    )
  );

  const paramResult = await generateNutritionParameters(userId);
  if (paramResult.ok) {
    await approveAllNutritionParameters(userId);
  }

  const answers = review.answers as WeeklyReviewAnswers | null;
  const mealPlanResult = await generateAndSaveMealPlan(userId, {
    extraExcludeKeywords: splitKeywords(answers?.mealsToDrop),
  });
  if (mealPlanResult.ok) {
    await approveMealPlanAndGenerateDownstream(userId);
  }

  const brief = review.brief as WeeklyBrief;
  const today = todayIso();

  await supabase
    .from("weekly_outcomes")
    .update({ status: "completed" })
    .eq("user_id", userId)
    .in("status", ["proposed", "active"]);

  if (brief.priorities.length > 0) {
    await supabase.from("weekly_outcomes").insert(
      brief.priorities.map((p) => ({
        user_id: userId,
        week_start: today,
        outcome_text: p.title,
        status: "proposed",
      }))
    );
  }

  const { error } = await supabase
    .from("weekly_reviews")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", review.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data: undefined };
}
