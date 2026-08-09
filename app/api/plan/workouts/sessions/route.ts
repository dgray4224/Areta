import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { getProgramPhaseHydrated } from "@/domains/trainingprogram/service";

const WEEK_START_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Bearer-token-authenticated endpoint listing a target week's program
 * phase sessions (mobile WorkoutWeekCustomizer's session picker, the
 * program-based fork of the redesigned "Customize this week" workout
 * flow). No mobile-facing endpoint exposed a phase's full session
 * roster before this -- getAlternativeSessions (used by the existing
 * "Alternative workout suggestions" card) always excludes one session,
 * which isn't what a "pick any session to assign" picker wants. Reads
 * program_phase_id directly off workout_plans rather than going through
 * getWorkoutPlanForWeek's WorkoutPlanView, which abstracts that id away
 * into programContext (name/phase/week only, not the raw id this needs).
 *
 * Returns `{ programPhaseId: null, sessions: [] }` for a week with no
 * plan yet or a legacy/goal-first plan -- the mobile client already
 * knows to route to the exercise-level fork in that case (same
 * programContext !== null check the Plan tab summary already uses), so
 * this is a defensive default, not the primary signal.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  const weekStart = request.nextUrl.searchParams.get("weekStart");
  if (!weekStart || !WEEK_START_PATTERN.test(weekStart)) {
    return NextResponse.json({ error: "weekStart query param must be a YYYY-MM-DD date string" }, { status: 400 });
  }

  const { data: plan } = await supabase
    .from("workout_plans")
    .select("program_phase_id")
    .eq("user_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (!plan?.program_phase_id) {
    return NextResponse.json({ programPhaseId: null, sessions: [] });
  }

  const phase = await getProgramPhaseHydrated(plan.program_phase_id, supabase);
  if (!phase) {
    return NextResponse.json({ programPhaseId: null, sessions: [] });
  }

  return NextResponse.json({
    programPhaseId: plan.program_phase_id,
    sessions: phase.sessions.map((s) => ({
      id: s.id,
      name: s.name,
      sessionType: s.sessionType,
      exerciseCount: s.exercises.length,
    })),
  });
}
