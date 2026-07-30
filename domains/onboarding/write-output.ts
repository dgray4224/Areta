import type { SupabaseClient } from "@supabase/supabase-js";
import type { OnboardingOutput, OnboardingResponses } from "@/domains/onboarding/types";
import type { ActionResult } from "@/platform/auth/actions";
import { DOMAIN_LABELS } from "@/domains/goals/schema";

/**
 * No `next/headers` or `server-only` imports here on purpose: this module
 * is shared between the Next.js Server Action path (`orchestrator.ts`,
 * which supplies a cookie-bound client) and `scripts/seed.ts` — a
 * standalone Node script with no Next.js request context, which supplies a
 * service-role admin client instead. Keeping this file free of Next-only
 * imports is what makes that sharing possible.
 */

/**
 * Writes the (user-edited, user-approved) Onboarding output across
 * profiles/domains/goals/phases/weekly_outcomes/daily_checkin_fields/
 * personalization_profiles, and marks onboarding complete.
 *
 * Known limitation: these are sequential inserts, not a single DB
 * transaction — supabase-js doesn't expose multi-statement transactions
 * without a Postgres function. A partial failure can leave some tables
 * written and others not; acceptable for the Phase 0/1 vertical slice, but
 * worth hardening with an RPC function before this becomes multi-user.
 */
export async function writeOnboardingOutput(
  supabase: SupabaseClient,
  userId: string,
  responses: OnboardingResponses,
  output: OnboardingOutput
): Promise<ActionResult> {
  if (!responses.identity) {
    return { ok: false, error: "Identity step is not complete." };
  }
  const identity = responses.identity;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      full_name: identity.fullName,
      time_zone: identity.timeZone,
      units: identity.units,
      wake_time: identity.wakeTime,
      bed_time: identity.bedTime,
      work_status: identity.workStatus,
      work_hours_note: identity.workHoursNote ?? null,
      school_commitments: identity.schoolCommitments ?? null,
      weekly_review_day: identity.weeklyReviewDay,
      grocery_day: identity.groceryDay,
      meal_prep_day: identity.mealPrepDay,
      learning_time_minutes_per_week: identity.learningTimeMinutesPerWeek,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (profileError) {
    return { ok: false, error: `Failed to save profile: ${profileError.message}` };
  }

  const domainIdByKey = new Map<string, string>();
  for (const key of output.activeDomains) {
    const { data, error } = await supabase
      .from("domains")
      .upsert(
        { user_id: userId, key, label: DOMAIN_LABELS[key] ?? key, is_active: true },
        { onConflict: "user_id,key" }
      )
      .select("id, key")
      .single();

    if (error || !data) {
      return { ok: false, error: `Failed to save domain "${key}": ${error?.message}` };
    }
    domainIdByKey.set(key, data.id);
  }

  const goalIdByOutcome = new Map<string, string>();
  for (const goal of output.rankedGoals) {
    // V1's bundled "Health" goal has no "health" row in `domains` (see
    // deriveActiveDomains in transform.ts — it fans out into nutrition/
    // exercise/sleep rows instead), so link it to "nutrition" specifically:
    // that's the one downstream consumer (generateNutritionParameters) that
    // looks up a goal's target date via its linked domain today.
    const domainLookupKey = goal.domainKey === "health" ? "nutrition" : goal.domainKey;
    const { data, error } = await supabase
      .from("goals")
      .insert({
        user_id: userId,
        domain_id: domainIdByKey.get(domainLookupKey) ?? null,
        outcome: goal.outcome,
        why: goal.why ?? null,
        target_date: goal.targetDate || null,
        starting_state: goal.startingState ?? null,
        constraints: goal.constraints ?? null,
        success_criteria: goal.successCriteria ?? null,
        priority: goal.priority,
        confidence: goal.confidence,
        known_obstacles: goal.knownObstacles ?? null,
      })
      .select("id, outcome")
      .single();

    if (error || !data) {
      return { ok: false, error: `Failed to save goal "${goal.outcome}": ${error?.message}` };
    }
    goalIdByOutcome.set(goal.outcome, data.id);
  }

  for (const phase of output.currentPhases) {
    const { error } = await supabase.from("phases").insert({
      user_id: userId,
      goal_id: goalIdByOutcome.get(phase.goalOutcome) ?? null,
      name: phase.name,
      mission: phase.mission,
      is_current: true,
    });
    if (error) {
      return { ok: false, error: `Failed to save phase "${phase.name}": ${error.message}` };
    }
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  for (const outcome of output.initialWeeklyOutcomes) {
    const { error } = await supabase.from("weekly_outcomes").insert({
      user_id: userId,
      goal_id: goalIdByOutcome.get(outcome.goalOutcome) ?? null,
      week_start: todayIso,
      outcome_text: outcome.outcomeText,
      status: "proposed",
    });
    if (error) {
      return { ok: false, error: `Failed to save weekly outcome: ${error.message}` };
    }
  }

  const { error: personalizationError } = await supabase
    .from("personalization_profiles")
    .upsert(
      {
        user_id: userId,
        tone: output.initialPersonalizationProfile.tone,
        planning_style: output.initialPersonalizationProfile.planningStyle,
        reminder_preference: output.initialPersonalizationProfile.reminderPreference,
        explanation_depth: output.initialPersonalizationProfile.explanationDepth,
        reschedule_missed_tasks: output.initialPersonalizationProfile.rescheduleMissedTasks,
        never_recommend: output.initialPersonalizationProfile.neverRecommend,
      },
      { onConflict: "user_id" }
    );

  if (personalizationError) {
    return {
      ok: false,
      error: `Failed to save personalization profile: ${personalizationError.message}`,
    };
  }

  const { error: checkinError } = await supabase
    .from("daily_checkin_fields")
    .upsert({ user_id: userId, fields: output.dailyCheckinFields }, { onConflict: "user_id" });

  if (checkinError) {
    return { ok: false, error: `Failed to save daily check-in fields: ${checkinError.message}` };
  }

  return { ok: true, data: undefined };
}
