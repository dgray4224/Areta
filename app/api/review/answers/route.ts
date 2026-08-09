import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { saveReviewAnswers } from "@/domains/review/service";

/** Bearer-authenticated write for the mobile lightweight-interview step —
 * called on each field's blur, not per keystroke (see review-screens/
 * InterviewStep.tsx), so partial answers survive the app backgrounding
 * mid-interview. */
export async function PATCH(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const answers = (body as { answers?: unknown } | null)?.answers;
  if (typeof answers !== "object" || answers === null || Array.isArray(answers)) {
    return NextResponse.json({ error: "Expected { answers: Record<string, string> }" }, { status: 400 });
  }

  const result = await saveReviewAnswers(userId, answers as Record<string, string>, supabase);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
