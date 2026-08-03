import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import {
  getActiveWorkoutPlan,
  setWorkoutPlanItemCompleted,
  setWorkoutPlanItemScheduledTime,
  setWorkoutPlanItemNotes,
  swapWorkoutPlanItemExercise,
} from "@/domains/workoutplan/service";
import { getExercisesByIds } from "@/domains/exerciselibrary/service";
import { getSlotOptions } from "@/domains/trainingprogram/service";
import type { ProgramSessionExercise } from "@/domains/trainingprogram/types";
import { hasEquipment } from "@/domains/workoutplan/generate";
import type { Exercise } from "@/domains/exerciselibrary/types";
import type { ExerciseInput } from "@/domains/exercise/schema";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";

/**
 * Bearer-token-authenticated read/write endpoint for the mobile Exercise
 * tab (CLAUDE.md §14/§15). GET returns today's planned exercises (from the
 * active workout plan, filtered to today's day-of-week) alongside today's
 * already-synced HealthKit workout_logs — workout detail continues to
 * flow in automatically via /api/health-sync, this endpoint only adds the
 * missing link to the plan, plus up to 2 curated alternates per exercise
 * (equipment-filtered) the user can swap to. PATCH marks a planned
 * exercise done/not-done or edits its schedule/notes. POST swaps a
 * planned exercise for one of its alternates -- kept as a distinct verb
 * rather than folded into PATCH, since it overwrites the exercise/
 * prescription fields together (not an independent single-field update)
 * and needs its own server-side sibling validation
 * (swapWorkoutPlanItemExercise).
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

async function getUserEquipmentAccess(userId: string, supabase: SupabaseClient<Database>): Promise<string[]> {
  const { data: onboardingRow } = await supabase
    .from("onboarding_responses")
    .select("exercise")
    .eq("user_id", userId)
    .maybeSingle();
  return ((onboardingRow?.exercise as ExerciseInput | null)?.equipmentAccess ?? []) as string[];
}

/** Formats a raw alternate/primary option for the mobile client,
 * equipment-filtering out anything the user can't actually do. */
function buildAlternativeViews(
  options: ProgramSessionExercise[],
  exerciseMap: Map<string, Exercise>,
  equipmentAccess: string[]
) {
  return options
    .filter((opt) => {
      const exercise = exerciseMap.get(opt.exerciseId);
      return exercise ? hasEquipment(exercise, equipmentAccess) : false;
    })
    .map((opt) => ({
      id: opt.id,
      exerciseName: exerciseMap.get(opt.exerciseId)?.name ?? "Unknown exercise",
      sets: opt.sets,
      reps: opt.repsMax ?? opt.repsMin,
      durationMinutes: opt.durationMinutes,
      repsMin: opt.repsMin,
      repsMax: opt.repsMax,
      intensityType: opt.intensityType,
      intensityValue: opt.intensityValue,
      cardioIntensity: opt.cardioIntensity,
      coachingNotes: opt.coachingNotes,
    }));
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

  const currentPrescriptionIds = todaysItems
    .map((item) => item.programSessionExerciseId)
    .filter((id): id is string => id !== null);
  const [slotOptionsByCurrentId, equipmentAccess] = await Promise.all([
    getSlotOptions(currentPrescriptionIds, supabase),
    getUserEquipmentAccess(userId, supabase),
  ]);

  const allExerciseIds = new Set(todaysItems.map((item) => item.exerciseId));
  for (const options of slotOptionsByCurrentId.values()) {
    for (const opt of options) allExerciseIds.add(opt.exerciseId);
  }
  const exerciseMap = await getExercisesByIds(Array.from(allExerciseIds), supabase);

  const plannedExercises = todaysItems.map((item) => {
    const options = (item.programSessionExerciseId ? slotOptionsByCurrentId.get(item.programSessionExerciseId) : undefined) ?? [];
    return {
      id: item.id,
      exerciseName: exerciseMap.get(item.exerciseId)?.name ?? "Unknown exercise",
      instructions: exerciseMap.get(item.exerciseId)?.instructions ?? null,
      sets: item.sets,
      reps: item.reps,
      durationMinutes: item.durationMinutes,
      completedAt: item.completedAt,
      scheduledTime: item.scheduledTime,
      notes: item.notes,
      repsMin: item.repsMin,
      repsMax: item.repsMax,
      intensityType: item.intensityType,
      intensityValue: item.intensityValue,
      cardioIntensity: item.cardioIntensity,
      coachingNotes: item.coachingNotes,
      substituted: item.substituted,
      alternatives: buildAlternativeViews(options, exerciseMap, equipmentAccess),
    };
  });

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

  return NextResponse.json({
    plan: plannedExercises,
    todaysWorkoutLogs: workoutLogs ?? [],
    programContext: plan?.programContext ?? null,
  });
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

/** Swaps a planned exercise for one of its curated alternates (or back to
 * the recommended default) -- see swapWorkoutPlanItemExercise for the
 * server-side sibling validation that makes this safe against a
 * manipulated targetProgramSessionExerciseId. */
export async function POST(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  let body: { itemId?: unknown; targetProgramSessionExerciseId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.itemId !== "string" || typeof body.targetProgramSessionExerciseId !== "string") {
    return NextResponse.json(
      { error: "itemId (string) and targetProgramSessionExerciseId (string) are required" },
      { status: 400 }
    );
  }

  const result = await swapWorkoutPlanItemExercise(userId, body.itemId, body.targetProgramSessionExerciseId, supabase);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // programSessionExerciseId is guaranteed non-null here -- swapWorkoutPlanItemExercise
  // only succeeds when the item was already program-linked (that's part of what it validates).
  const newPrescriptionId = result.data.programSessionExerciseId as string;
  const [equipmentAccess, slotOptionsByCurrentId] = await Promise.all([
    getUserEquipmentAccess(userId, supabase),
    getSlotOptions([newPrescriptionId], supabase),
  ]);
  const options = slotOptionsByCurrentId.get(newPrescriptionId) ?? [];

  const allExerciseIds = new Set([result.data.exerciseId, ...options.map((o) => o.exerciseId)]);
  const exerciseMap = await getExercisesByIds(Array.from(allExerciseIds), supabase);

  return NextResponse.json({
    ok: true,
    item: {
      id: result.data.id,
      exerciseName: exerciseMap.get(result.data.exerciseId)?.name ?? "Unknown exercise",
      instructions: exerciseMap.get(result.data.exerciseId)?.instructions ?? null,
      sets: result.data.sets,
      reps: result.data.reps,
      durationMinutes: result.data.durationMinutes,
      completedAt: result.data.completedAt,
      scheduledTime: result.data.scheduledTime,
      notes: result.data.notes,
      repsMin: result.data.repsMin,
      repsMax: result.data.repsMax,
      intensityType: result.data.intensityType,
      intensityValue: result.data.intensityValue,
      cardioIntensity: result.data.cardioIntensity,
      coachingNotes: result.data.coachingNotes,
      substituted: result.data.substituted,
      alternatives: buildAlternativeViews(options, exerciseMap, equipmentAccess),
    },
  });
}
