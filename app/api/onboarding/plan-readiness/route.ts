import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { getPlanReadiness } from "@/domains/onboarding/generate-plans";

/** Readiness check for the mobile post-onboarding "generate my plans?"
 * popup — which plans can be generated from what the user filled in,
 * and what's missing otherwise. */
export async function GET(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const readiness = await getPlanReadiness(auth.userId, auth.supabase);
  return NextResponse.json(readiness);
}
