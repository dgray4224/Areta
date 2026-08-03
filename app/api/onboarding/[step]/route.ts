import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import type { OnboardingStepKey } from "@/domains/onboarding/types";
import { saveIdentityStep } from "@/domains/identity/service";
import { saveGoalsStep } from "@/domains/goals/service";
import { saveNutritionStep } from "@/domains/nutrition/service";
import { saveExerciseStep } from "@/domains/exercise/service";
import { saveRecoveryStep, skipRecoveryStep } from "@/domains/recovery/service";
import { saveLearningStep } from "@/domains/learning/service";
import type { ActionResult } from "@/platform/auth/actions";

const STEP_KEYS: readonly OnboardingStepKey[] = ["identity", "goals", "nutrition", "exercise", "recovery", "learning"];

function isStepKey(value: string): value is OnboardingStepKey {
  return (STEP_KEYS as readonly string[]).includes(value);
}

/**
 * Saves one onboarding step's answers -- thin bearer-authenticated
 * wrapper around the exact same save<Domain>Step functions the web
 * onboarding pages call as Server Actions (no duplicated validation or
 * write logic). `recovery` accepts an optional `{skip: true}` body to
 * mirror the web RecoveryForm's "skip this step" affordance.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ step: string }> }) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  const { step } = await params;
  if (!isStepKey(step)) {
    return NextResponse.json({ error: `Unknown onboarding step "${step}"` }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  let result: ActionResult;
  switch (step) {
    case "identity":
      result = await saveIdentityStep(userId, body, supabase);
      break;
    case "goals":
      result = await saveGoalsStep(userId, body, supabase);
      break;
    case "nutrition":
      result = await saveNutritionStep(userId, body, supabase);
      break;
    case "exercise":
      result = await saveExerciseStep(userId, body, supabase);
      break;
    case "recovery":
      result =
        typeof body === "object" && body !== null && (body as { skip?: unknown }).skip === true
          ? await skipRecoveryStep(userId, supabase)
          : await saveRecoveryStep(userId, body, supabase);
      break;
    case "learning":
      result = await saveLearningStep(userId, body, supabase);
      break;
  }

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
