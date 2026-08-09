import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { generateWeeklyBrief } from "@/domains/review/service";

/** Bearer-authenticated trigger for the mobile "Generate my weekly brief"
 * button — thin wrapper around the same generateWeeklyBrief the web
 * GenerateBriefButton calls as a Server Action, so both platforms run the
 * exact same engine/prompt. */
export async function POST(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  const result = await generateWeeklyBrief(userId, supabase);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
