import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { generatePlansAfterOnboarding } from "@/domains/onboarding/generate-plans";

/** One-tap plan setup for the mobile post-onboarding popup — runs the
 * full generate-and-approve cascade for the nutrition and workout plans
 * (see domains/onboarding/generate-plans.ts for the approval-semantics
 * rationale). Returns per-plan outcomes; a partial failure is a 200
 * with that plan's error, not a 4xx, so the popup can summarize
 * honestly. */
export async function POST(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const result = await generatePlansAfterOnboarding(auth.userId, auth.supabase);
  return NextResponse.json(result);
}
