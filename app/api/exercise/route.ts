import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import {
  getActiveWorkoutPlan,
  setWorkoutPlanItemCompleted,
  setWorkoutPlanItemScheduledTime,
  setWorkoutPlanItemNotes,
  swapWorkoutPlanItemExercise,
  customizeWorkoutPlanItemExercise,
  addWorkoutPlanItemExercise,
  selectAlternativeSessionForToday,
} from "@/domains/workoutplan/service";
import { getExercisesByIds } from "@/domains/exerciselibrary/service";
import { getSlotOptions, getSessionForPrescription, getAlternativeSessions } from "@/domains/trainingprogram/service";
import type { ProgramSessionExercise } from "@/domains/trainingprogram/types";
import { hasEquipment } from "@/domains/workoutplan/generate";
import { buildWorkoutRationale } from "@/domains/workoutplan/rationale";
import type { Exercise } from "@/domains/exerciselibrary/types";
import type { ExerciseInput } from "@/domains/exercise/schema";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/platform/db/types";
import { todayForUser } from "@/domains/activity-summary/service";

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
 *
 * `?date=` (GET/POST) generalizes all of the above from "today" to any
 * day -- added for the mobile Plan tab's day-detail view, which needs to
 * edit/swap items on days other than today, the same way /api/nutrition
 * already supports ?date=. Omitted, every existing today-only caller
 * (the Exercise tab) is unaffected.
 */

function dayOfWeekFor(dateString: string): number {
  return new Date(`${dateString}T00:00:00Z`).getUTCDay();
}

function utcRangeForDate(dateString: string): { start: string; end: string } {
  const start = new Date(`${dateString}T00:00:00.000Z`);
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

/** Formats a whole alternative session (name + preview of its default
 * exercises) for the mobile client's "Alternative workout suggestions" --
 * deliberately not equipment-filtered per exercise like buildAlternativeViews
 * (a whole session isn't dropped over one exercise's equipment mismatch;
 * that's sorted out via the usual per-exercise swap once the session is
 * actually selected -- see selectAlternativeSessionForToday). */
function buildAlternativeSessionViews(
  sessions: Awaited<ReturnType<typeof getAlternativeSessions>>,
  exerciseMap: Map<string, Exercise>
) {
  return sessions.map((session) => ({
    id: session.id,
    name: session.name,
    sessionType: session.sessionType,
    exercises: session.exercises.map((ex) => ({
      exerciseName: exerciseMap.get(ex.exerciseId)?.name ?? "Unknown exercise",
      sets: ex.sets,
      reps: ex.repsMax ?? ex.repsMin,
      durationMinutes: ex.durationMinutes,
      repsMin: ex.repsMin,
      repsMax: ex.repsMax,
      intensityType: ex.intensityType,
      intensityValue: ex.intensityValue,
      cardioIntensity: ex.cardioIntensity,
    })),
  }));
}

export async function GET(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  const date = request.nextUrl.searchParams.get("date") ?? (await todayForUser(supabase, userId));
  const plan = await getActiveWorkoutPlan(userId, supabase, date);
  const dow = dayOfWeekFor(date);
  const tomorrowDow = (dow + 1) % 7;
  const todaysItems = plan?.items.filter((item) => item.dayOfWeek === dow) ?? [];
  const tomorrowsItems = plan?.items.filter((item) => item.dayOfWeek === tomorrowDow) ?? [];

  const currentPrescriptionIds = todaysItems
    .map((item) => item.programSessionExerciseId)
    .filter((id): id is string => id !== null);
  const tomorrowsFirstPrescriptionId = tomorrowsItems.find((item) => item.programSessionExerciseId !== null)
    ?.programSessionExerciseId as string | undefined;
  const [slotOptionsByCurrentId, equipmentAccess, todaysSession, tomorrowsSession] = await Promise.all([
    getSlotOptions(currentPrescriptionIds, supabase),
    getUserEquipmentAccess(userId, supabase),
    // Every item materialized for a given day shares one program_sessions
    // row, so the first item's prescription is enough to identify the
    // whole day's session -- both its name (lets a legitimately short day
    // like deload/taper/cardio-only read as intentional instead of
    // broken) and its id/phaseId (to look up alternative sessions below).
    currentPrescriptionIds.length > 0 ? getSessionForPrescription(currentPrescriptionIds[0], supabase) : null,
    // Same lookup for tomorrow -- purely to explain today's exercise-count/
    // intensity choice against what's actually coming next for this user,
    // not to display tomorrow's plan itself (see buildWorkoutRationale).
    tomorrowsFirstPrescriptionId ? getSessionForPrescription(tomorrowsFirstPrescriptionId, supabase) : null,
  ]);

  const alternativeSessions = todaysSession
    ? await getAlternativeSessions(todaysSession.phaseId, todaysSession.id, supabase)
    : [];

  const allExerciseIds = new Set(todaysItems.map((item) => item.exerciseId));
  for (const options of slotOptionsByCurrentId.values()) {
    for (const opt of options) allExerciseIds.add(opt.exerciseId);
  }
  for (const session of alternativeSessions) {
    for (const ex of session.exercises) allExerciseIds.add(ex.exerciseId);
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

  const { start, end } = utcRangeForDate(date);
  const { data: workoutRows, error } = await supabase
    .from("health_metrics")
    .select("id, started_at, ended_at, activity_type, total_energy_burned_kcal, total_distance_meters")
    .eq("user_id", userId)
    .eq("metric_type", "workout")
    .gte("started_at", start)
    .lt("started_at", end)
    .order("started_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Mobile client contract is start_date/end_date/duration_minutes (the
  // pre-migration workout_logs shape) — preserved here even though storage
  // moved to health_metrics' started_at/ended_at.
  const workoutLogs = (workoutRows ?? []).map((r) => ({
    id: r.id,
    start_date: r.started_at,
    end_date: r.ended_at,
    activity_type: r.activity_type,
    duration_minutes: r.ended_at
      ? Math.round((new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()) / 60000)
      : 0,
    total_energy_burned_kcal: r.total_energy_burned_kcal,
    total_distance_meters: r.total_distance_meters,
  }));

  const rationale = buildWorkoutRationale({
    today:
      todaysSession?.name && todaysSession.sessionType
        ? { name: todaysSession.name, sessionType: todaysSession.sessionType, exerciseCount: todaysItems.length }
        : null,
    tomorrow:
      tomorrowsSession?.name && tomorrowsSession.sessionType
        ? { name: tomorrowsSession.name, sessionType: tomorrowsSession.sessionType, exerciseCount: tomorrowsItems.length }
        : null,
  });

  return NextResponse.json({
    plan: plannedExercises,
    todaysWorkoutLogs: workoutLogs ?? [],
    programContext: plan?.programContext ?? null,
    todaysSessionName: todaysSession?.name ?? null,
    rationale,
    alternativeSessions: buildAlternativeSessionViews(alternativeSessions, exerciseMap),
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

  let body: {
    itemId?: unknown;
    targetProgramSessionExerciseId?: unknown;
    exerciseId?: unknown;
    sets?: unknown;
    reps?: unknown;
    durationMinutes?: unknown;
    sessionId?: unknown;
    date?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const resolvedDate = typeof body.date === "string" ? body.date : await todayForUser(supabase, userId);
  const dayOfWeek = dayOfWeekFor(resolvedDate);

  // Four distinct actions share this endpoint: swap to one of the slot's
  // up-to-2 curated alternates (itemId + targetProgramSessionExerciseId),
  // a free-form customize of an existing item to any library exercise
  // (itemId + exerciseId), adding a brand-new item to today's session
  // (exerciseId alone, no itemId), or replacing today's whole plan with a
  // different session from the same phase (sessionId alone -- "Alternative
  // workout suggestions"). Checked first since it's a distinct shape from
  // the other three (no itemId/exerciseId at all).
  if (typeof body.sessionId === "string") {
    const result = await selectAlternativeSessionForToday(userId, dayOfWeek, body.sessionId, supabase);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    // The client re-fetches via GET afterward for the full new plan
    // (today's session name, program context, fresh alternatives) rather
    // than this duplicating that response shape inline.
    return NextResponse.json({ ok: true });
  }

  if (typeof body.targetProgramSessionExerciseId === "string") {
    if (typeof body.itemId !== "string") {
      return NextResponse.json({ error: "itemId (string) is required" }, { status: 400 });
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

  if (typeof body.exerciseId === "string") {
    const sets = typeof body.sets === "number" ? body.sets : null;
    const reps = typeof body.reps === "number" ? body.reps : null;
    const durationMinutes = typeof body.durationMinutes === "number" ? body.durationMinutes : null;

    const result = typeof body.itemId === "string"
      ? await customizeWorkoutPlanItemExercise(userId, body.itemId, { exerciseId: body.exerciseId, sets, reps, durationMinutes }, supabase)
      : await addWorkoutPlanItemExercise(userId, dayOfWeek, { exerciseId: body.exerciseId, sets, reps, durationMinutes }, supabase, resolvedDate);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const exerciseMap = await getExercisesByIds([result.data.exerciseId], supabase);

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
        // Neither a custom swap nor a freshly added item is tied to an
        // authored slot -- no curated-alternates set exists to offer back.
        alternatives: [],
      },
    });
  }

  return NextResponse.json(
    { error: "Either targetProgramSessionExerciseId or exerciseId is required" },
    { status: 400 }
  );
}
