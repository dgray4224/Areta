import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import {
  getActiveWorkoutPlan,
  setWorkoutPlanItemCompleted,
  setWorkoutPlanItemScheduledTime,
  setWorkoutPlanItemNotes,
} from "@/domains/workoutplan/service";
import { getExercisesByIds } from "@/domains/exerciselibrary/service";

/**
 * Bearer-token-authenticated read/write endpoint for the mobile Exercise
 * tab (CLAUDE.md §14/§15). GET returns today's planned exercises (from the
 * active workout plan, filtered to today's day-of-week) alongside today's
 * already-synced HealthKit workout_logs — workout detail continues to
 * flow in automatically via /api/health-sync, this endpoint only adds the
 * missing link to the plan. PATCH marks a planned exercise done/not-done.
 */

function todayDayOfWeek(): number {
  return new Date().getUTCDay();
}

function todayUtcRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function GET(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  const plan = await getActiveWorkoutPlan(userId, supabase);
  const dow = todayDayOfWeek();
  const todaysItems = plan?.items.filter((item) => item.dayOfWeek === dow) ?? [];
  const exerciseMap = await getExercisesByIds(
    todaysItems.map((item) => item.exerciseId),
    supabase
  );

  const plannedExercises = todaysItems.map((item) => ({
    id: item.id,
    exerciseName: exerciseMap.get(item.exerciseId)?.name ?? "Unknown exercise",
    sets: item.sets,
    reps: item.reps,
    durationMinutes: item.durationMinutes,
    completedAt: item.completedAt,
    scheduledTime: item.scheduledTime,
    notes: item.notes,
  }));

  const { start, end } = todayUtcRange();
  const { data: workoutLogs, error } = await supabase
    .from("workout_logs")
    .select(
      "id, start_date, end_date, activity_type, duration_minutes, total_energy_burned_kcal, total_distance_meters"
    )
    .eq("user_id", userId)
    .gte("start_date", start)
    .lt("start_date", end)
    .order("start_date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ plan: plannedExercises, todaysWorkoutLogs: workoutLogs ?? [] });
}

export async function PATCH(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  let body: { itemId?: unknown; completed?: unknown; scheduledTime?: unknown; notes?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.itemId !== "string") {
    return NextResponse.json({ error: "itemId (string) is required" }, { status: 400 });
  }
  const hasCompleted = typeof body.completed === "boolean";
  const hasScheduledTime = typeof body.scheduledTime === "string" || body.scheduledTime === null;
  const hasNotes = typeof body.notes === "string" || body.notes === null;
  if (!hasCompleted && !hasScheduledTime && !hasNotes) {
    return NextResponse.json(
      {
        error:
          "at least one of completed (boolean), scheduledTime (string | null), or notes (string | null) is required",
      },
      { status: 400 }
    );
  }

  if (hasCompleted) {
    const result = await setWorkoutPlanItemCompleted(userId, body.itemId, body.completed as boolean, supabase);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
  }
  if (hasScheduledTime) {
    const result = await setWorkoutPlanItemScheduledTime(
      userId,
      body.itemId,
      body.scheduledTime as string | null,
      supabase
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
  }
  if (hasNotes) {
    const result = await setWorkoutPlanItemNotes(userId, body.itemId, body.notes as string | null, supabase);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
  }
  return NextResponse.json({ ok: true });
}
