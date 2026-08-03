import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { getOnboardingReview, confirmOnboarding } from "@/domains/onboarding/orchestrator";
import type { OnboardingOutput } from "@/domains/onboarding/types";

/**
 * Confirms onboarding -- mirrors app/(app)/onboarding/review/page.tsx +
 * ReviewForm.tsx's submit action. The client is expected to have fetched
 * GET /api/onboarding, let the user edit the derived `output` (mission/
 * phases/weekly outcomes/daily-checkin fields, same editable review step
 * as web), and posts the final edited output back here. Responses are
 * re-fetched server-side (not trusted from the client) since they're the
 * source of truth confirmOnboarding writes from.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  let body: { output?: OnboardingOutput };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.output) {
    return NextResponse.json({ error: "output is required" }, { status: 400 });
  }

  const { responses, output: derivedOutput } = await getOnboardingReview(userId, supabase);
  if (!derivedOutput) {
    return NextResponse.json({ error: "Complete every onboarding step before confirming." }, { status: 400 });
  }

  const result = await confirmOnboarding(userId, responses, body.output, supabase);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
