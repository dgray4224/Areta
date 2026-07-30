/**
 * Dev-only: creates (or reuses) the founder's dev account and seeds it with
 * the CLAUDE.md §17 profile, reusing the exact same validation
 * (Zod schemas), derivation (`transformOnboarding`), and multi-table write
 * logic (`writeOnboardingOutput`) the real onboarding flow uses — just
 * invoked with a service-role admin client instead of a signed-in user's
 * session, since this runs outside any Next.js request.
 *
 * Refuses to run unless ALLOW_SEED=true is set in .env.local. Never wired
 * into build or deploy — invoke manually with `pnpm run seed`.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createScriptAdminClient } from "./lib/admin-client";
import { transformOnboarding } from "@/domains/onboarding/transform";
import { writeOnboardingOutput } from "@/domains/onboarding/write-output";
import type { OnboardingResponses } from "@/domains/onboarding/types";
import {
  FOUNDER_EMAIL,
  FOUNDER_PASSWORD,
  founderIdentity,
  founderWorkSchedule,
  founderGoals,
  founderNutrition,
  founderRecovery,
  founderLearning,
  founderCoaching,
  founderCompletedSteps,
} from "@/supabase/seed/dev-seed";

async function main() {
  if (process.env.ALLOW_SEED !== "true") {
    console.error(
      "Refusing to seed: set ALLOW_SEED=true in .env.local to run this dev-only script.\n" +
        "Never run this against a production Supabase project."
    );
    process.exit(1);
  }

  const supabase = createScriptAdminClient();

  const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw listError;

  let userId = existingUsers.users.find((u) => u.email === FOUNDER_EMAIL)?.id;

  if (!userId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: FOUNDER_EMAIL,
      password: FOUNDER_PASSWORD,
      email_confirm: true,
    });
    if (error || !data.user) {
      throw error ?? new Error("Failed to create founder dev user");
    }
    userId = data.user.id;
    console.log(`Created founder dev user: ${FOUNDER_EMAIL}`);
  } else {
    console.log(`Reusing existing founder dev user: ${FOUNDER_EMAIL}`);
  }

  const { data: existingProfile, error: profileSelectError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (profileSelectError) throw profileSelectError;

  if (!existingProfile) {
    const { error } = await supabase.from("profiles").insert({ id: userId });
    if (error) throw error;
  }

  const responses: OnboardingResponses = {
    userId,
    identity: founderIdentity,
    goals: founderGoals,
    nutrition: founderNutrition,
    exercise: null,
    recovery: founderRecovery,
    learning: founderLearning,
    completedSteps: founderCompletedSteps,
  };

  const { error: onboardingError } = await supabase.from("onboarding_responses").upsert(
    {
      user_id: userId,
      identity: responses.identity,
      goals: responses.goals,
      nutrition: responses.nutrition,
      recovery: responses.recovery,
      learning: responses.learning,
      completed_steps: responses.completedSteps,
    },
    { onConflict: "user_id" }
  );
  if (onboardingError) throw onboardingError;

  const output = transformOnboarding(responses);
  const result = await writeOnboardingOutput(supabase, userId, responses, output);

  if (!result.ok) {
    throw new Error(result.error);
  }

  // Coaching and work/school are no longer onboarding steps — seed them the
  // same way Settings -> Personalization would, straight onto the live rows.
  const { error: workScheduleError } = await supabase
    .from("profiles")
    .update({
      work_status: founderWorkSchedule.workStatus || null,
      work_hours_note: founderWorkSchedule.workHoursNote || null,
      school_commitments: founderWorkSchedule.schoolCommitments || null,
      learning_time_minutes_per_week: founderWorkSchedule.learningTimeMinutesPerWeek ?? null,
    })
    .eq("id", userId);
  if (workScheduleError) throw workScheduleError;

  const { error: coachingError } = await supabase.from("personalization_profiles").upsert(
    {
      user_id: userId,
      tone: founderCoaching.tone,
      planning_style: founderCoaching.planningStyle,
      reminder_preference: founderCoaching.reminderPreference,
      explanation_depth: founderCoaching.explanationDepth,
      reschedule_missed_tasks: founderCoaching.rescheduleMissedTasks,
      never_recommend: founderCoaching.neverRecommend,
    },
    { onConflict: "user_id" }
  );
  if (coachingError) throw coachingError;

  console.log("Seed complete.");
  console.log(`  Email:    ${FOUNDER_EMAIL}`);
  console.log(`  Password: ${FOUNDER_PASSWORD}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
