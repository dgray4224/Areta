"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/platform/supabase/server";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";
import { getApprovedParameterValue, getGeneratedParameters } from "@/domains/parameters/service";
import { getAllExercises } from "@/domains/exerciselibrary/service";
import { generateWorkoutPlan, materializeWorkoutPlan } from "@/domains/workoutplan/generate";
import { selectProgram, resolveProgression, type LastWorkoutPlanInfo } from "@/domains/workoutplan/rotation";
import {
  getEligibleProgramCandidates,
  getFirstPhaseId,
  getPhaseById,
  getNextPhase,
  getProgramPhaseHydrated,
  getSessionExerciseById,
} from "@/domains/trainingprogram/service";
import { isLegacyExerciseShape } from "@/domains/exercise/legacy";
import type { ExerciseInput } from "@/domains/exercise/schema";
import { generateGoalFirstPlan } from "@/domains/recommendation/service";
import { logScheduleEvent, hasActualScheduleEventToday } from "@/platform/scheduling/log-schedule-event";
import { getWeekDates, addDays } from "@/platform/ui/week-dates";
import { todayForUser } from "@/domains/activity-summary/service";

/**
 * Generates a fresh weekly workout schedule as a draft from the user's
 * approved Exercise parameters, stated equipment access, and the shared
 * exercise library. Mirrors domains/mealplan/service.ts's
 * generateAndSaveMealPlan. Still needs an explicit approve step (see
 * approveWorkoutPlan) before it's "active" (CLAUDE.md rule 10).
 *
 * Prefers a real, periodized training_programs phase (rotation.ts decides
 * whether to continue the user's current phase, advance to the next one,
 * or select a new program) over the legacy archetype-only greedy
 * generator, which now only serves as the fallback when no program is
 * eligible for the user's archetype/equipment/experience combination.
 */
export async function generateAndSaveWorkoutPlan(
  userId: string,
  options?: { weekStart?: string },
  client?: SupabaseClient<Database>
): Promise<ActionResult<{ warnings: string[] }>> {
  const supabase = client ?? (await createClient());
  const weekStart = options?.weekStart ?? (await todayForUser(supabase, userId));

  // A client with an active trainer-assigned program (2026-08-06) should
  // never have it silently clobbered by the library generator — both
  // upsert onto the same (user_id, week_start) row, so whichever ran last
  // would win with no warning either way. Trainer-side generation always
  // goes through generateAndSaveFromTrainerProgram instead, which is
  // exempt from this check (different code path entirely); this only
  // guards the path a client or trainer could otherwise reach by mistake
  // (the client's own "Generate" button on their Workouts page, or a
  // trainer's demoted-to-secondary "Generate from library" action).
  const { data: activeAssignment } = await supabase
    .from("trainer_program_assignments")
    .select("id")
    .eq("client_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (activeAssignment) {
    return {
      ok: false,
      error: "Your trainer has assigned you a program. Ask them to change or unassign it before generating a plan here.",
    };
  }

  const [sessionsPerWeek, parameters, { data: responses }] = await Promise.all([
    getApprovedParameterValue(userId, "exercise", "sessions_per_week", supabase),
    getGeneratedParameters(userId, "exercise", supabase),
    supabase.from("onboarding_responses").select("exercise").eq("user_id", userId).single(),
  ]);

  if (sessionsPerWeek === null) {
    return { ok: false, error: "Approve your training parameters before generating a workout plan." };
  }

  const exercise = responses?.exercise ?? {};
  // Two generation families behind one entry point (2026-08-07):
  // legacy archetype-shape users keep the program/rotation pipeline
  // below, byte-for-byte; everyone onboarded through the current
  // goal-first Exercise step routes to domains/recommendation/* (the
  // "Phase 4" engine 0044's schema was built for) -- this closed the
  // "coming soon" gap where new-shape users could never generate a
  // workout plan at all.
  if (!isLegacyExerciseShape(exercise) || !exercise.archetype) {
    return generateAndSaveGoalFirstPlan(userId, exercise as ExerciseInput, sessionsPerWeek, weekStart, supabase);
  }

  const archetype = exercise.archetype;
  const equipmentAccess = exercise.equipmentAccess ?? [];
  const experienceLevel = exercise.experienceLevel ?? "beginner";

  const primaryFocusParam = parameters.find((p) => p.id === "primary_focus" && p.approved);
  const legacyPhaseFocus = typeof primaryFocusParam?.value === "string" ? primaryFocusParam.value : null;

  const exercises = await getAllExercises(supabase);

  const [candidates, { data: lastPlanRow }, { data: historyRows }] = await Promise.all([
    getEligibleProgramCandidates(archetype, supabase),
    supabase
      .from("workout_plans")
      .select("program_id, program_phase_id, phase_week_number, week_start")
      .eq("user_id", userId)
      .not("program_id", "is", null)
      .lt("week_start", weekStart)
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("workout_plans")
      .select("program_id, week_start")
      .eq("user_id", userId)
      .not("program_id", "is", null)
      .order("week_start", { ascending: true }),
  ]);

  const lastUsedByProgramId = new Map<string, string>();
  for (const row of historyRows ?? []) {
    if (row.program_id) lastUsedByProgramId.set(row.program_id, row.week_start);
  }
  const usedProgramIds = Array.from(lastUsedByProgramId.keys());

  let lastPlan: LastWorkoutPlanInfo | null = null;
  let currentPhase = null;
  let nextPhase = null;
  if (lastPlanRow?.program_id && lastPlanRow.program_phase_id && lastPlanRow.phase_week_number !== null) {
    const [lastProgramRow, phase] = await Promise.all([
      supabase.from("training_programs").select("archetype").eq("id", lastPlanRow.program_id).maybeSingle(),
      getPhaseById(lastPlanRow.program_phase_id, supabase),
    ]);
    currentPhase = phase;
    if (currentPhase) {
      nextPhase = await getNextPhase(currentPhase, supabase);
    }
    if (lastProgramRow.data && currentPhase) {
      lastPlan = {
        programId: lastPlanRow.program_id,
        programArchetype: lastProgramRow.data.archetype,
        phaseId: lastPlanRow.program_phase_id,
        phaseWeekNumber: lastPlanRow.phase_week_number,
        weekStart: lastPlanRow.week_start,
      };
    }
  }

  const decision = resolveProgression({ lastPlan, currentArchetype: archetype, newWeekStart: weekStart, currentPhase, nextPhase });

  let programId: string | null = null;
  let phaseId: string | null = null;
  let phaseWeekNumber: number | null = null;
  const warnings: string[] = [];

  if (decision.kind === "continue_phase") {
    programId = decision.programId;
    phaseId = decision.phaseId;
    phaseWeekNumber = decision.weekNumber;
  } else if (decision.kind === "advance_phase") {
    programId = decision.programId;
    phaseId = decision.phaseId;
    phaseWeekNumber = 1;
  } else {
    const { program, warnings: selectionWarnings } = selectProgram({
      userId,
      archetype,
      candidates,
      equipmentAccess,
      experienceLevel,
      sessionsPerWeek,
      usedProgramIds,
      lastUsedByProgramId,
    });
    warnings.push(...selectionWarnings);
    if (program) {
      programId = program.id;
      phaseId = await getFirstPhaseId(program.id, supabase);
      phaseWeekNumber = 1;
    }
  }

  let days: ReturnType<typeof generateWorkoutPlan>["days"] = [];
  let phaseFocus = legacyPhaseFocus;

  if (phaseId) {
    const hydratedPhase = await getProgramPhaseHydrated(phaseId, supabase);
    if (hydratedPhase) {
      const result = materializeWorkoutPlan({ phase: hydratedPhase, archetype, equipmentAccess, exercises, sessionsPerWeek });
      days = result.days;
      warnings.push(...result.warnings);
      phaseFocus = hydratedPhase.focus ?? legacyPhaseFocus;
    } else {
      programId = null;
      phaseId = null;
      phaseWeekNumber = null;
    }
  }

  if (!phaseId) {
    if (!programId) {
      warnings.push("No matching training program was available -- generated a general plan for your archetype instead.");
    }
    const result = generateWorkoutPlan({ sessionsPerWeek, archetype, equipmentAccess, exercises });
    days = result.days;
    warnings.push(...result.warnings);
  }

  const { data: plan, error: planError } = await supabase
    .from("workout_plans")
    .upsert(
      {
        user_id: userId,
        week_start: weekStart,
        status: "draft",
        sessions_per_week: sessionsPerWeek,
        phase_focus: phaseFocus,
        program_id: programId,
        program_phase_id: phaseId,
        phase_week_number: phaseWeekNumber,
      },
      { onConflict: "user_id,week_start" }
    )
    .select("id")
    .single();

  if (planError || !plan) {
    return { ok: false, error: `Failed to save workout plan: ${planError?.message}` };
  }

  const { error: deleteError } = await supabase
    .from("workout_plan_items")
    .delete()
    .eq("workout_plan_id", plan.id);
  if (deleteError) {
    return { ok: false, error: `Failed to clear previous plan items: ${deleteError.message}` };
  }

  const items = days.flatMap((day) =>
    day.exercises.map((ex, index) => ({
      workout_plan_id: plan.id,
      user_id: userId,
      day_of_week: day.dayOfWeek,
      session_order: index,
      exercise_id: ex.exerciseId,
      sets: ex.sets,
      reps: ex.reps,
      duration_minutes: ex.durationMinutes,
      program_session_exercise_id: ex.programSessionExerciseId,
      reps_min: ex.repsMin,
      reps_max: ex.repsMax,
      intensity_type: ex.intensityType,
      intensity_value: ex.intensityValue,
      cardio_intensity: ex.cardioIntensity,
      coaching_notes: ex.coachingNotes,
      substituted: ex.substituted,
    }))
  );

  if (items.length > 0) {
    const { error: itemsError } = await supabase.from("workout_plan_items").insert(items);
    if (itemsError) {
      return { ok: false, error: `Failed to save workout plan items: ${itemsError.message}` };
    }
  }

  return { ok: true, data: { warnings } };
}

/**
 * Goal-first half of generateAndSaveWorkoutPlan: runs the
 * recommendation engine, then persists through the same
 * workout_plans/workout_plan_items shape as the legacy branch --
 * template_id/template_phase_id tag the plan's source family (0088),
 * items carry template_slot_id + provenance (0044), and each item's
 * top-2 runner-up candidates land in workout_plan_item_alternatives.
 * Not exported: only reachable through generateAndSaveWorkoutPlan,
 * which already ran the trainer-assignment guard and the approved
 * sessions_per_week check.
 */
async function generateAndSaveGoalFirstPlan(
  userId: string,
  exercise: ExerciseInput,
  sessionsPerWeek: number,
  weekStart: string,
  supabase: SupabaseClient<Database>
): Promise<ActionResult<{ warnings: string[] }>> {
  const generated = await generateGoalFirstPlan(userId, exercise, sessionsPerWeek, weekStart, supabase);
  if (!generated.ok) return generated;
  const { days, extras, warnings, templateId, templatePhaseId, phaseWeekNumber, phaseFocus } = generated.data;

  const { data: plan, error: planError } = await supabase
    .from("workout_plans")
    .upsert(
      {
        user_id: userId,
        week_start: weekStart,
        status: "draft",
        sessions_per_week: sessionsPerWeek,
        phase_focus: phaseFocus,
        program_id: null,
        program_phase_id: null,
        template_id: templateId,
        template_phase_id: templatePhaseId,
        phase_week_number: phaseWeekNumber,
      },
      { onConflict: "user_id,week_start" }
    )
    .select("id")
    .single();
  if (planError || !plan) {
    return { ok: false, error: `Failed to save workout plan: ${planError?.message}` };
  }

  // Regenerating replaces the draft's items; alternates cascade-delete
  // with their item rows (workout_plan_item_alternatives FK).
  const { error: deleteError } = await supabase.from("workout_plan_items").delete().eq("workout_plan_id", plan.id);
  if (deleteError) {
    return { ok: false, error: `Failed to clear previous plan items: ${deleteError.message}` };
  }

  const items = days.flatMap((day) =>
    day.exercises.map((ex, index) => ({
      workout_plan_id: plan.id,
      user_id: userId,
      day_of_week: day.dayOfWeek,
      session_order: index,
      exercise_id: ex.exerciseId,
      sets: ex.sets,
      reps: ex.reps,
      duration_minutes: ex.durationMinutes,
      reps_min: ex.repsMin,
      reps_max: ex.repsMax,
      intensity_type: ex.intensityType,
      intensity_value: ex.intensityValue,
      cardio_intensity: ex.cardioIntensity,
      coaching_notes: ex.coachingNotes,
      substituted: ex.substituted,
      template_slot_id: extras.get(`${day.dayOfWeek}:${index}`)?.templateSlotId ?? null,
      provenance: extras.get(`${day.dayOfWeek}:${index}`)?.provenance ?? null,
    }))
  );

  if (items.length > 0) {
    const { data: insertedItems, error: itemsError } = await supabase
      .from("workout_plan_items")
      .insert(items)
      .select("id, day_of_week, session_order");
    if (itemsError) {
      return { ok: false, error: `Failed to save workout plan items: ${itemsError.message}` };
    }

    const alternativeRows = (insertedItems ?? []).flatMap((item) => {
      const itemExtras = extras.get(`${item.day_of_week}:${item.session_order}`);
      return (itemExtras?.alternatives ?? []).map((alt) => ({
        workout_plan_item_id: item.id,
        exercise_id: alt.exerciseId,
        rank: alt.rank,
        score: alt.score,
      }));
    });
    if (alternativeRows.length > 0) {
      const { error: altError } = await supabase.from("workout_plan_item_alternatives").insert(alternativeRows);
      // Alternates are an enhancement, not plan content -- surface a
      // warning rather than failing the whole generation over them.
      if (altError) warnings.push(`Alternates could not be saved: ${altError.message}`);
    }
  }

  return { ok: true, data: { warnings } };
}

/**
 * Approves whatever the most recent *draft* plan actually is, by id --
 * not by an exact week_start === today match (found 2026-08-06, same
 * root cause as getCurrentWorkoutPlan's own doc comment: a draft's
 * week_start is stamped once, at generation time, so this would
 * previously silently match zero rows -- update()'s error is null on a
 * zero-row match, so approving would report success while doing
 * nothing -- for anyone approving on a different day than whenever the
 * draft was generated). Returns an explicit error when there's nothing
 * to approve instead of that silent no-op.
 */
export async function approveWorkoutPlan(userId: string, client?: SupabaseClient<Database>): Promise<ActionResult> {
  const supabase = client ?? (await createClient());
  const { data: draftPlan } = await supabase
    .from("workout_plans")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "draft")
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!draftPlan) return { ok: false, error: "No draft plan to approve." };

  const { error } = await supabase.from("workout_plans").update({ status: "active" }).eq("id", draftPlan.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

/**
 * Generates and auto-approves `weeks` consecutive workout plans starting
 * from `weekStart` (defaults to the current week), one after another.
 * Approving each week before generating the next lets resolveProgression
 * see it as "the previous week's plan" (it reads workout_plans rows with
 * week_start < the new week's), so phase advancement progresses correctly
 * across the run instead of every week resolving against the same
 * pre-loop state -- mirrors generateAndSaveMealPlanWeeks in
 * domains/mealplan/approve-flow.ts.
 */
export async function generateAndSaveWorkoutPlanWeeks(
  userId: string,
  weeks: number,
  weekStart?: string,
  client?: SupabaseClient<Database>
): Promise<ActionResult<{ warnings: string[] }>> {
  const supabase = client ?? (await createClient());
  const startWeek = weekStart ?? (await todayForUser(supabase, userId));
  const warnings: string[] = [];

  for (let i = 0; i < weeks; i++) {
    const targetWeekStart = i === 0 ? startWeek : addDays(startWeek, i * 7);
    const generateResult = await generateAndSaveWorkoutPlan(userId, { weekStart: targetWeekStart }, supabase);
    if (!generateResult.ok) return generateResult;
    warnings.push(...generateResult.data.warnings);

    const approveResult = await approveWorkoutPlan(userId, supabase);
    if (!approveResult.ok) return approveResult;
  }

  return { ok: true, data: { warnings } };
}

export type WorkoutPlanItemView = {
  id: string;
  dayOfWeek: number;
  sessionOrder: number;
  exerciseId: string;
  sets: number | null;
  reps: number | null;
  durationMinutes: number | null;
  completedAt: string | null;
  scheduledTime: string | null;
  notes: string | null;
  repsMin: number | null;
  repsMax: number | null;
  intensityType: "percent_1rm" | "rpe" | "none" | null;
  intensityValue: string | null;
  cardioIntensity: string | null;
  coachingNotes: string | null;
  /** Links back to the prescription this item was materialized from --
   * null for items from the legacy archetype-only generator. Used to
   * look up alternates (app/api/exercise/route.ts). */
  programSessionExerciseId: string | null;
  substituted: boolean;
};

/** Program/phase context for the active plan, if one was generated from a
 * training_programs phase rather than the legacy archetype-only
 * generator -- surfaced so the Exercise tab can show e.g. "Conjugate
 * Strength · Accumulation, Week 2". */
export type WorkoutPlanProgramContext = {
  programName: string;
  phaseName: string;
  phaseWeekNumber: number;
};

export type WorkoutPlanView = {
  id: string;
  weekStart: string;
  status: "draft" | "active" | "archived";
  sessionsPerWeek: number | null;
  phaseFocus: string | null;
  programContext: WorkoutPlanProgramContext | null;
  items: WorkoutPlanItemView[];
};

export async function getWorkoutPlanForWeek(
  userId: string,
  weekStart?: string,
  client?: SupabaseClient<Database>
): Promise<WorkoutPlanView | null> {
  const supabase = client ?? (await createClient());
  const resolvedWeekStart = weekStart ?? (await todayForUser(supabase, userId));
  // Excludes 'archived' (found 2026-08-07): this is an exact date match
  // with no other filter, so a stale row a trainer-program switch left
  // behind for today's date would otherwise still surface here as "the"
  // plan for today even after archiveStaleTrainerProgramPlans marks it
  // done -- see that function's own doc comment in domains/trainer/service.ts.
  const { data: plan } = await supabase
    .from("workout_plans")
    .select("id, week_start, status, sessions_per_week, phase_focus, program_id, program_phase_id, phase_week_number")
    .eq("user_id", userId)
    .eq("week_start", resolvedWeekStart)
    .neq("status", "archived")
    .maybeSingle();

  if (!plan) return null;

  const [{ data: items, error }, programContext] = await Promise.all([
    supabase
      .from("workout_plan_items")
      .select(
        "id, day_of_week, session_order, exercise_id, sets, reps, duration_minutes, completed_at, scheduled_time, notes, reps_min, reps_max, intensity_type, intensity_value, cardio_intensity, coaching_notes, substituted, program_session_exercise_id"
      )
      .eq("workout_plan_id", plan.id)
      .order("day_of_week", { ascending: true })
      .order("session_order", { ascending: true }),
    loadProgramContext(plan.program_id, plan.program_phase_id, plan.phase_week_number, supabase),
  ]);

  if (error) {
    throw new Error(`Failed to load workout plan items: ${error.message}`);
  }

  return {
    id: plan.id,
    weekStart: plan.week_start,
    status: plan.status as WorkoutPlanView["status"],
    sessionsPerWeek: plan.sessions_per_week,
    phaseFocus: plan.phase_focus,
    programContext,
    items: (items ?? []).map((i) => ({
      id: i.id,
      dayOfWeek: i.day_of_week,
      sessionOrder: i.session_order,
      exerciseId: i.exercise_id,
      sets: i.sets,
      reps: i.reps,
      durationMinutes: i.duration_minutes,
      completedAt: i.completed_at,
      scheduledTime: i.scheduled_time,
      notes: i.notes,
      repsMin: i.reps_min,
      repsMax: i.reps_max,
      intensityType: i.intensity_type as WorkoutPlanItemView["intensityType"],
      intensityValue: i.intensity_value,
      cardioIntensity: i.cardio_intensity,
      coachingNotes: i.coaching_notes,
      substituted: i.substituted,
      programSessionExerciseId: i.program_session_exercise_id,
    })),
  };
}

async function loadProgramContext(
  programId: string | null,
  programPhaseId: string | null,
  phaseWeekNumber: number | null,
  supabase: SupabaseClient<Database>
): Promise<WorkoutPlanProgramContext | null> {
  if (!programId || !programPhaseId || phaseWeekNumber === null) return null;

  const [{ data: program }, { data: phase }] = await Promise.all([
    supabase.from("training_programs").select("name").eq("id", programId).maybeSingle(),
    supabase.from("training_program_phases").select("name").eq("id", programPhaseId).maybeSingle(),
  ]);

  if (!program || !phase) return null;
  return { programName: program.name, phaseName: phase.name, phaseWeekNumber };
}

export async function getActiveWorkoutPlan(
  userId: string,
  client?: SupabaseClient<Database>
): Promise<WorkoutPlanView | null> {
  const supabase = client ?? (await createClient());

  // Bounded to the Sun-Sat week containing today (found 2026-08-07 while
  // investigating a real report of a not-yet-started trainer program
  // showing real exercise content): an unbounded "most recent active row
  // by week_start" silently picks up whatever the *furthest-future*
  // pushed-live week is once "push weeks live" has materialized several
  // weeks ahead (workout_plans.week_start is stamped per-anchor-date at
  // generation time, so several future rows can coexist as 'active'
  // simultaneously) -- showing that far-future week's real content as if
  // it were "this week's plan" is worse than the "no plan" gap this
  // function was originally written to close, since it's actively wrong
  // rather than honestly empty. Scoping the fallback to this calendar
  // week preserves the original intent (a plan generated on a different
  // day *within the same week* still resolves) without reaching past it.
  const today = await todayForUser(supabase, userId);
  const weekDates = getWeekDates(today);
  const { data: plan } = await supabase
    .from("workout_plans")
    .select("id, week_start, status, sessions_per_week, phase_focus")
    .eq("user_id", userId)
    .eq("status", "active")
    .gte("week_start", weekDates[0])
    .lte("week_start", weekDates[6])
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!plan) return null;
  return getWorkoutPlanForWeek(userId, plan.week_start, supabase);
}

/**
 * Resilient "what should this user see as their current workout plan"
 * lookup -- found missing 2026-08-06 while building a trainer feature
 * that surfaces exactly this gap. getWorkoutPlanForWeek's own default
 * (week_start === today, exact match) only matches on the *exact* day a
 * plan was generated or approved, since both only ever stamp week_start
 * with "today at that moment" and the weekly cron (or a client's own
 * generate/approve click) typically only touches a given plan once per
 * week. Every day other than that one, the dashboard and /plan/workouts
 * would see a real, still-active plan as "no plan at all" -- pre-existing,
 * not introduced by the trainer-program work, but directly blocking it
 * (a trainer materializing a future week needs the client to actually
 * be able to see it on whatever day they check, not just the day it was
 * generated).
 *
 * Tries the exact-today row first, same as before -- a same-day fresh
 * draft still shows immediately, unchanged from prior behavior -- then
 * falls back to the most recent *active* row regardless of date (the
 * same resilient query getActiveWorkoutPlan above already uses for the
 * mobile API). The two together cover both cases that matter: "I just
 * generated/edited something today" and "nothing changed today, but
 * what I approved earlier this week is still what's current".
 */
export async function getCurrentWorkoutPlan(
  userId: string,
  client?: SupabaseClient<Database>
): Promise<WorkoutPlanView | null> {
  const supabase = client ?? (await createClient());
  const todaysPlan = await getWorkoutPlanForWeek(userId, undefined, supabase);
  if (todaysPlan) return todaysPlan;
  return getActiveWorkoutPlan(userId, supabase);
}

/**
 * Marks a planned exercise done/not-done (mobile Exercise tab). Purely a
 * completion flag -- unlike meal-plan completion, this does NOT create a
 * log row, since HealthKit's workout_logs already captures what actually
 * happened independently of the plan. This is strictly "did I follow
 * today's plan," not a data-capture mechanism.
 */
export async function setWorkoutPlanItemCompleted(
  userId: string,
  itemId: string,
  completed: boolean,
  client?: SupabaseClient<Database>
): Promise<ActionResult> {
  const supabase = client ?? (await createClient());
  const { error } = await supabase
    .from("workout_plan_items")
    .update({ completed_at: completed ? new Date().toISOString() : null })
    .eq("id", itemId)
    .eq("user_id", userId);

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: undefined };
}

/**
 * Sets (or clears, if null) the user's dragged/chosen clock time for a
 * planned exercise (mobile Exercise/At-a-Glance timeline). A separate
 * function from setWorkoutPlanItemCompleted -- different trigger
 * (drag-release vs. a tap) and zero shared logic.
 */
export async function setWorkoutPlanItemScheduledTime(
  userId: string,
  itemId: string,
  scheduledTime: string | null,
  client?: SupabaseClient<Database>
): Promise<ActionResult> {
  const supabase = client ?? (await createClient());
  const { error } = await supabase
    .from("workout_plan_items")
    .update({ scheduled_time: scheduledTime })
    .eq("id", itemId)
    .eq("user_id", userId);

  if (error) {
    return { ok: false, error: error.message };
  }
  if (scheduledTime) {
    // "workout" is a fixed label, not per-exercise -- a whole session is
    // scheduled as one group (see the mobile timeline's consolidated
    // "Workout" chip), so every exercise scheduled together collapses
    // into the same day's row rather than fragmenting per exercise.
    //
    // Actual HealthKit-synced workout time (see insertImportedWorkoutLog)
    // is the stronger signal for learning real routine -- if today's row
    // already reflects actual behavior, a plan reschedule must not
    // downgrade it back to a guess.
    const actualAlreadyRecorded = await hasActualScheduleEventToday(userId, "workout", "workout", supabase);
    if (!actualAlreadyRecorded) {
      await logScheduleEvent(userId, "workout", "workout", itemId, scheduledTime, supabase, "planned");
    }
  }
  return { ok: true, data: undefined };
}

/** Free-text note on a single planned exercise (mobile timeline detail view). */
export async function setWorkoutPlanItemNotes(
  userId: string,
  itemId: string,
  notes: string | null,
  client?: SupabaseClient<Database>
): Promise<ActionResult> {
  const supabase = client ?? (await createClient());
  const { error } = await supabase
    .from("workout_plan_items")
    .update({ notes })
    .eq("id", itemId)
    .eq("user_id", userId);

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, data: undefined };
}

/**
 * Swaps a planned exercise for one of its curated alternates (or back to
 * the recommended default) -- mobile Exercise tab "swap" affordance. A
 * per-instance, today-only choice: the next weekly regeneration
 * (generateAndSaveWorkoutPlan) deletes and re-inserts all of a week's
 * workout_plan_items regardless, silently discarding completedAt/
 * scheduledTime/notes today already, so a swap being wiped on the next
 * regeneration is the same class of behavior, not a new gap.
 *
 * Server-side validates that `targetProgramSessionExerciseId` is
 * actually a sibling of the item's current prescription (shares the same
 * "primary" slot) before applying anything -- without this, a
 * manipulated request could point a plan item at an unrelated program's
 * row and corrupt the day's display with mismatched fields.
 */
export async function swapWorkoutPlanItemExercise(
  userId: string,
  itemId: string,
  targetProgramSessionExerciseId: string,
  client?: SupabaseClient<Database>
): Promise<ActionResult<WorkoutPlanItemView>> {
  const supabase = client ?? (await createClient());

  const { data: item, error: itemError } = await supabase
    .from("workout_plan_items")
    .select("id, program_session_exercise_id, day_of_week, session_order, completed_at, scheduled_time, notes")
    .eq("id", itemId)
    .eq("user_id", userId)
    .maybeSingle();

  if (itemError) return { ok: false, error: itemError.message };
  if (!item) return { ok: false, error: "Planned exercise not found." };
  if (!item.program_session_exercise_id) {
    return { ok: false, error: "This exercise wasn't generated from a training program and has no alternates." };
  }

  const currentRx = await getSessionExerciseById(item.program_session_exercise_id, supabase);
  if (!currentRx) return { ok: false, error: "Current prescription not found." };

  const targetRx = await getSessionExerciseById(targetProgramSessionExerciseId, supabase);
  if (!targetRx) return { ok: false, error: "Target exercise not found." };

  const primaryId = currentRx.primaryExerciseId ?? currentRx.id;
  const targetIsValidSibling = targetRx.id === primaryId || targetRx.primaryExerciseId === primaryId;
  if (!targetIsValidSibling) {
    return { ok: false, error: "The requested exercise isn't a valid alternate for this slot." };
  }

  const { error: updateError } = await supabase
    .from("workout_plan_items")
    .update({
      exercise_id: targetRx.exerciseId,
      sets: targetRx.sets,
      reps: targetRx.repsMax ?? targetRx.repsMin,
      duration_minutes: targetRx.durationMinutes,
      program_session_exercise_id: targetRx.id,
      reps_min: targetRx.repsMin,
      reps_max: targetRx.repsMax,
      intensity_type: targetRx.intensityType,
      intensity_value: targetRx.intensityValue,
      cardio_intensity: targetRx.cardioIntensity,
      coaching_notes: targetRx.coachingNotes,
      substituted: false,
    })
    .eq("id", itemId)
    .eq("user_id", userId);

  if (updateError) return { ok: false, error: updateError.message };

  return {
    ok: true,
    data: {
      id: item.id,
      dayOfWeek: item.day_of_week,
      sessionOrder: item.session_order,
      exerciseId: targetRx.exerciseId,
      sets: targetRx.sets,
      reps: targetRx.repsMax ?? targetRx.repsMin,
      durationMinutes: targetRx.durationMinutes,
      completedAt: item.completed_at,
      scheduledTime: item.scheduled_time,
      notes: item.notes,
      repsMin: targetRx.repsMin,
      repsMax: targetRx.repsMax,
      intensityType: targetRx.intensityType,
      intensityValue: targetRx.intensityValue,
      cardioIntensity: targetRx.cardioIntensity,
      coachingNotes: targetRx.coachingNotes,
      substituted: false,
      programSessionExerciseId: targetRx.id,
    },
  };
}

export type CustomizeExerciseInput = {
  exerciseId: string;
  sets: number | null;
  reps: number | null;
  durationMinutes: number | null;
};

/**
 * Free-form version of swapWorkoutPlanItemExercise -- lets a user pick
 * ANY exercise in the library (mobile "browse by muscle group" picker),
 * not just one of the slot's up-to-2 curated alternates, with their own
 * sets/reps or duration. No sibling validation, since there's no
 * authored slot to validate against; only equipment/archetype-blind by
 * explicit product decision (the picker itself doesn't filter by
 * equipment either -- see app/api/exercise/library/route.ts).
 *
 * program_session_exercise_id is cleared (same shape a legacy-generator
 * item already has -- see generateWorkoutPlan) since this is no longer
 * tied to an authored prescription, and so is exchange for a curated
 * alternate afterward (getSlotOptions requires a program_session_exercise_id
 * to resolve options from, which a customized item no longer has -- an
 * item can be curated-swapped OR freely customized in its lifetime, not
 * both in sequence, until the next weekly regeneration resets it).
 */
export async function customizeWorkoutPlanItemExercise(
  userId: string,
  itemId: string,
  input: CustomizeExerciseInput,
  client?: SupabaseClient<Database>
): Promise<ActionResult<WorkoutPlanItemView>> {
  const supabase = client ?? (await createClient());

  const { data: item, error: itemError } = await supabase
    .from("workout_plan_items")
    .select("id, day_of_week, session_order, completed_at, scheduled_time, notes")
    .eq("id", itemId)
    .eq("user_id", userId)
    .maybeSingle();

  if (itemError) return { ok: false, error: itemError.message };
  if (!item) return { ok: false, error: "Planned exercise not found." };

  const { data: exerciseRow, error: exerciseError } = await supabase
    .from("exercises")
    .select("id, name, instructions")
    .eq("id", input.exerciseId)
    .maybeSingle();
  if (exerciseError) return { ok: false, error: exerciseError.message };
  if (!exerciseRow) return { ok: false, error: "Exercise not found." };

  const { error: updateError } = await supabase
    .from("workout_plan_items")
    .update({
      exercise_id: exerciseRow.id,
      sets: input.sets,
      reps: input.reps,
      duration_minutes: input.durationMinutes,
      program_session_exercise_id: null,
      reps_min: null,
      reps_max: null,
      intensity_type: null,
      intensity_value: null,
      cardio_intensity: null,
      coaching_notes: null,
      substituted: true,
    })
    .eq("id", itemId)
    .eq("user_id", userId);

  if (updateError) return { ok: false, error: updateError.message };

  return {
    ok: true,
    data: {
      id: item.id,
      dayOfWeek: item.day_of_week,
      sessionOrder: item.session_order,
      exerciseId: exerciseRow.id,
      sets: input.sets,
      reps: input.reps,
      durationMinutes: input.durationMinutes,
      completedAt: item.completed_at,
      scheduledTime: item.scheduled_time,
      notes: item.notes,
      repsMin: null,
      repsMax: null,
      intensityType: null,
      intensityValue: null,
      cardioIntensity: null,
      coachingNotes: null,
      substituted: true,
      programSessionExerciseId: null,
    },
  };
}

/**
 * Inserts a brand-new plan item into today's session (Exercise tab
 * "add exercise" flow), rather than replacing an existing one -- same
 * free-form library access as customizeWorkoutPlanItemExercise, appended
 * at the end of today's exercise order instead of overwriting a slot.
 * Not scoped to "just today": workout_plan_items are keyed by
 * day_of_week within the current active plan, so this reappears every
 * calendar day that maps to today's day_of_week until the plan's next
 * weekly regeneration -- the same lifetime the existing swap/customize
 * paths already have, not a new persistence model.
 */
export async function addWorkoutPlanItemExercise(
  userId: string,
  dayOfWeek: number,
  input: CustomizeExerciseInput,
  client?: SupabaseClient<Database>
): Promise<ActionResult<WorkoutPlanItemView>> {
  const supabase = client ?? (await createClient());

  const { data: plan, error: planError } = await supabase
    .from("workout_plans")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (planError) return { ok: false, error: planError.message };
  if (!plan) return { ok: false, error: "No active workout plan found." };

  const { data: exerciseRow, error: exerciseError } = await supabase
    .from("exercises")
    .select("id, name, instructions")
    .eq("id", input.exerciseId)
    .maybeSingle();
  if (exerciseError) return { ok: false, error: exerciseError.message };
  if (!exerciseRow) return { ok: false, error: "Exercise not found." };

  const { data: lastItem, error: lastItemError } = await supabase
    .from("workout_plan_items")
    .select("session_order")
    .eq("workout_plan_id", plan.id)
    .eq("day_of_week", dayOfWeek)
    .order("session_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastItemError) return { ok: false, error: lastItemError.message };
  const nextOrder = (lastItem?.session_order ?? -1) + 1;

  const { data: inserted, error: insertError } = await supabase
    .from("workout_plan_items")
    .insert({
      workout_plan_id: plan.id,
      user_id: userId,
      day_of_week: dayOfWeek,
      session_order: nextOrder,
      exercise_id: exerciseRow.id,
      sets: input.sets,
      reps: input.reps,
      duration_minutes: input.durationMinutes,
      program_session_exercise_id: null,
      reps_min: null,
      reps_max: null,
      intensity_type: null,
      intensity_value: null,
      cardio_intensity: null,
      coaching_notes: null,
      substituted: false,
    })
    .select("id, day_of_week, session_order, completed_at, scheduled_time, notes")
    .single();
  if (insertError || !inserted) return { ok: false, error: insertError?.message ?? "Failed to add exercise." };

  return {
    ok: true,
    data: {
      id: inserted.id,
      dayOfWeek: inserted.day_of_week,
      sessionOrder: inserted.session_order,
      exerciseId: exerciseRow.id,
      sets: input.sets,
      reps: input.reps,
      durationMinutes: input.durationMinutes,
      completedAt: inserted.completed_at,
      scheduledTime: inserted.scheduled_time,
      notes: inserted.notes,
      repsMin: null,
      repsMax: null,
      intensityType: null,
      intensityValue: null,
      cardioIntensity: null,
      coachingNotes: null,
      substituted: false,
      programSessionExerciseId: null,
    },
  };
}

/**
 * Replaces today's entire planned session with a different session from
 * the same phase (mobile Exercise tab's "Alternative workout suggestions"
 * -- a whole-session swap, distinct from swapWorkoutPlanItemExercise's
 * per-exercise one). The chosen session becomes the new "recommended"
 * plan for today, fully customizable like any materialized day; whatever
 * was there before is simply gone (not preserved as an alternative --
 * getAlternativeSessions recomputes the phase's other sessions fresh on
 * the next read, which already includes it).
 *
 * Re-validates sessionId belongs to the active plan's own program_phase_id
 * server-side (not just trusts whatever the client sends) -- same class
 * of guard as swapWorkoutPlanItemExercise's sibling-slot check, since a
 * plan's phase is what scopes which sessions are legitimate "alternatives"
 * for it.
 *
 * Rebalances the rest of the week rather than overwriting today in
 * isolation: materializeWorkoutPlan only ever uses as many of a phase's
 * authored sessions as there are training days that week (e.g. 5 of 6 for
 * a 5-day week), so swapping today to a session that's already scheduled
 * on another day would otherwise silently duplicate it and drop whatever
 * that other day was going to be. Instead, if the target session is
 * already scheduled on a day that's today or still ahead this week, that
 * day trades places with today (today's old session moves there) --
 * a minimal-diff pairwise swap, not a full week regeneration. A day that
 * already happened is never touched (explicit product decision -- a
 * completed/logged day shouldn't visually change after the fact); if the
 * target session isn't scheduled anywhere this week (or only on a day
 * that's already passed), it's the "leftover" session materializeWorkoutPlan
 * didn't use, and today just takes it directly with no swap partner needed.
 */
export async function selectAlternativeSessionForToday(
  userId: string,
  dayOfWeek: number,
  sessionId: string,
  client?: SupabaseClient<Database>
): Promise<ActionResult<{ rebalancedDayOfWeek: number | null }>> {
  const supabase = client ?? (await createClient());

  const { data: plan, error: planError } = await supabase
    .from("workout_plans")
    .select("id, program_phase_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (planError) return { ok: false, error: planError.message };
  if (!plan) return { ok: false, error: "No active workout plan found." };
  if (!plan.program_phase_id) {
    return { ok: false, error: "This plan wasn't generated from a training program and has no alternative sessions." };
  }

  const { data: sessionRow, error: sessionError } = await supabase
    .from("program_sessions")
    .select("id, phase_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError) return { ok: false, error: sessionError.message };
  if (!sessionRow || sessionRow.phase_id !== plan.program_phase_id) {
    return { ok: false, error: "The requested session isn't a valid alternative for today's plan." };
  }

  const { data: exerciseRows, error: exercisesError } = await supabase
    .from("program_session_exercises")
    .select("*")
    .eq("session_id", sessionId)
    .is("primary_exercise_id", null)
    .order("exercise_order", { ascending: true });
  if (exercisesError) return { ok: false, error: exercisesError.message };
  if (!exerciseRows || exerciseRows.length === 0) {
    return { ok: false, error: "That session has no exercises to switch to." };
  }

  // This week's current day -> session mapping, to find a same-session
  // swap partner (today-or-later only). Every item materialized for a
  // given day shares one session_id (materializeWorkoutPlan's own
  // invariant -- see its module comment), so the first prescription seen
  // per day is enough to identify that day's session.
  const { data: weekItems, error: weekItemsError } = await supabase
    .from("workout_plan_items")
    .select("day_of_week, program_session_exercise_id")
    .eq("workout_plan_id", plan.id)
    .not("program_session_exercise_id", "is", null);
  if (weekItemsError) return { ok: false, error: weekItemsError.message };

  const prescriptionIds = Array.from(
    new Set(
      (weekItems ?? [])
        .map((item) => item.program_session_exercise_id)
        .filter((id): id is string => id !== null)
    )
  );
  const { data: prescriptionRows, error: prescriptionError } =
    prescriptionIds.length > 0
      ? await supabase.from("program_session_exercises").select("id, session_id").in("id", prescriptionIds)
      : { data: [] as { id: string; session_id: string }[], error: null };
  if (prescriptionError) return { ok: false, error: prescriptionError.message };
  const sessionIdByPrescriptionId = new Map((prescriptionRows ?? []).map((row) => [row.id, row.session_id]));

  const sessionIdByDay = new Map<number, string>();
  for (const item of weekItems ?? []) {
    if (!item.program_session_exercise_id) continue;
    const sid = sessionIdByPrescriptionId.get(item.program_session_exercise_id);
    if (sid) sessionIdByDay.set(item.day_of_week, sid);
  }

  const todaysCurrentSessionId = sessionIdByDay.get(dayOfWeek) ?? null;

  let swapPartnerDay: number | null = null;
  for (const [day, sid] of sessionIdByDay) {
    if (day === dayOfWeek || day < dayOfWeek) continue;
    if (sid === sessionId) {
      swapPartnerDay = day;
      break;
    }
  }

  const buildItems = (rows: NonNullable<typeof exerciseRows>, forDayOfWeek: number) =>
    rows.map((rx, index) => ({
      workout_plan_id: plan.id,
      user_id: userId,
      day_of_week: forDayOfWeek,
      session_order: index,
      exercise_id: rx.exercise_id,
      sets: rx.sets,
      reps: rx.reps_max ?? rx.reps_min,
      duration_minutes: rx.duration_minutes,
      program_session_exercise_id: rx.id,
      reps_min: rx.reps_min,
      reps_max: rx.reps_max,
      intensity_type: rx.intensity_type,
      intensity_value: rx.intensity_value,
      cardio_intensity: rx.cardio_intensity,
      coaching_notes: rx.coaching_notes,
      substituted: false,
    }));

  const { error: deleteTodayError } = await supabase
    .from("workout_plan_items")
    .delete()
    .eq("workout_plan_id", plan.id)
    .eq("day_of_week", dayOfWeek);
  if (deleteTodayError) return { ok: false, error: `Failed to clear today's plan: ${deleteTodayError.message}` };

  const { error: insertTodayError } = await supabase.from("workout_plan_items").insert(buildItems(exerciseRows, dayOfWeek));
  if (insertTodayError) return { ok: false, error: `Failed to save the new session: ${insertTodayError.message}` };

  let rebalancedDayOfWeek: number | null = null;

  if (swapPartnerDay !== null && todaysCurrentSessionId) {
    const { data: partnerExerciseRows, error: partnerExercisesError } = await supabase
      .from("program_session_exercises")
      .select("*")
      .eq("session_id", todaysCurrentSessionId)
      .is("primary_exercise_id", null)
      .order("exercise_order", { ascending: true });
    if (partnerExercisesError) return { ok: false, error: partnerExercisesError.message };

    if (partnerExerciseRows && partnerExerciseRows.length > 0) {
      const { error: deletePartnerError } = await supabase
        .from("workout_plan_items")
        .delete()
        .eq("workout_plan_id", plan.id)
        .eq("day_of_week", swapPartnerDay);
      if (deletePartnerError) return { ok: false, error: `Failed to rebalance the swapped day: ${deletePartnerError.message}` };

      const { error: insertPartnerError } = await supabase
        .from("workout_plan_items")
        .insert(buildItems(partnerExerciseRows, swapPartnerDay));
      if (insertPartnerError) return { ok: false, error: `Failed to rebalance the swapped day: ${insertPartnerError.message}` };

      rebalancedDayOfWeek = swapPartnerDay;
    }
  }

  return { ok: true, data: { rebalancedDayOfWeek } };
}
