import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { ensureProfile } from "@/domains/identity/service";
import { getOnboardingReview } from "@/domains/onboarding/orchestrator";
import { firstIncompleteStep } from "@/domains/onboarding/transform";
import { isLegacyExerciseShape } from "@/domains/exercise/legacy";

/**
 * Bearer-token-authenticated onboarding entry point for mobile (see
 * app/api/exercise/route.ts for the same auth pattern). Mirrors
 * app/(app)/onboarding/page.tsx's server-side redirect logic, but as
 * data mobile can branch its own router on rather than an HTTP redirect
 * mobile can't follow into a Next.js page. GET returns the user's raw
 * per-step answers, the derived `output` (once every step is complete --
 * same as web's editable review screen), which step (if any) still
 * needs answering, and whether their Exercise answers are still in the
 * pre-goal-first shape (needs a one-time re-onboard even if every step
 * is otherwise "complete" -- see domains/exercise/legacy.ts).
 *
 * `onboardingComplete` deliberately checks `profiles.onboarding_completed_at`
 * (set only by confirmOnboarding/writeOnboardingOutput, i.e. after the
 * review screen's "Approve and activate"), NOT just "every step
 * answered" -- otherwise a user who finished all six steps but hasn't
 * confirmed yet would get routed straight into the tabs before
 * writeOnboardingOutput has ever run, same bug class web avoids via
 * the dashboard's `onboarding_completed_at` check.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  await ensureProfile(userId, supabase);
  const [{ responses, output }, { data: profile }] = await Promise.all([
    getOnboardingReview(userId, supabase),
    supabase.from("profiles").select("onboarding_completed_at").eq("id", userId).maybeSingle(),
  ]);
  const nextStep = firstIncompleteStep(responses);
  const needsExerciseReOnboard = isLegacyExerciseShape(responses.exercise);

  return NextResponse.json({
    responses,
    output,
    nextStep,
    needsExerciseReOnboard,
    onboardingComplete: Boolean(profile?.onboarding_completed_at),
  });
}
