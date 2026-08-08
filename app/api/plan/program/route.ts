import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { getPhasesForProgram } from "@/domains/trainingprogram/service";
import { getWeekDates } from "@/platform/ui/week-dates";

/**
 * Bearer-token-authenticated endpoint for the mobile Plan tab's
 * "Program/Phase" sub-tab. Two genuinely different "phase" concepts,
 * both surfaced here (see migration 0030's own comment distinguishing
 * them):
 *
 * - `lifePhase`: the CLAUDE.md hierarchy's Phases level (`phases` table,
 *   `is_current`) -- a name + mission the user got once at onboarding
 *   completion, tied to a goal. Not shown anywhere on mobile before this.
 * - `workoutProgram`: periodization within whichever workout-generation
 *   system produced the active plan -- "Phase 2 of 4," focus,
 *   week-in-phase, what's next. **Two parallel systems exist and this
 *   branches on both**, found the hard way (a first pass only read the
 *   legacy path and silently returned null for every goal-first-engine
 *   user, which is most/all current users per the web repo's own
 *   changelog):
 *     - Legacy/self-service: `workout_plans.program_id`/`program_phase_id`
 *       -> `training_programs`/`training_program_phases`.
 *     - Goal-first engine (domains/recommendation): `workout_plans.
 *       template_id`/`template_phase_id` -> `program_templates`/
 *       `template_phases` -- structurally identical rows (see
 *       domains/recommendation/types.ts's `TemplatePhase`, field-for-field
 *       the same as `TrainingProgramPhase`), just a different source
 *       table pair. generateAndSaveGoalFirstPlan always sets
 *       program_id/program_phase_id to null and template_id/
 *       template_phase_id instead -- see that function's own comment in
 *       domains/workoutplan/service.ts.
 *     - Trainer-coached: `workout_plans.trainer_program_id`/
 *       `trainer_program_phase_id` -> `trainer_programs`/
 *       `trainer_program_phases` (domains/trainerprogram/materialize.ts).
 *       Same phase shape again (`TrainerProgramPhase`, migration 0075's
 *       RLS explicitly lets the assigned client -- not just the trainer
 *       -- read these rows: `trainer_programs_assigned_client_select`/
 *       `trainer_program_phases_assigned_client_select`). One real
 *       difference: materialize.ts always writes `phase_week_number:
 *       null` for this path (no per-plan pointer, see
 *       calendar-projection.ts's doc comment on why it's pure date
 *       arithmetic instead), so week-in-phase is computed here from the
 *       assignment's `starts_on` + the phase lengths ahead of it, same
 *       arithmetic as that file's own (unexported) `resolvePhaseForDate`.
 */

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

type WorkoutProgramView = {
  programName: string;
  sessionsPerWeek: number | null;
  phaseName: string;
  phaseFocus: string | null;
  weekInPhase: number | null;
  lengthWeeks: number;
  phaseNumber: number;
  totalPhases: number;
  isFinalPhase: boolean;
  nextPhaseName: string | null;
};

/** Shared shape both the legacy and goal-first phase rows map to --
 * TrainingProgramPhase and TemplatePhase are already field-for-field
 * identical (see comment above), this just names that shared shape. */
type PhaseLike = { id: string; name: string; focus: string | null; lengthWeeks: number; isFinal: boolean };

/** Trainer-coached plans carry no per-plan week-in-phase pointer (see
 * comment above) -- this derives it from the assignment start date the
 * same way calendar-projection.ts's resolvePhaseForDate does, just
 * narrowed to "what week within the phase we already know is current"
 * rather than also determining which phase (that's already resolved,
 * it's the id on the plan row). */
function computeWeekInCurrentPhase(startsOn: string, phases: PhaseLike[], currentPhaseId: string, today: string): number | null {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksSinceStart = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${startsOn}T00:00:00Z`)) / msPerWeek);
  if (weeksSinceStart < 0) return null;

  let weeksBeforeCurrentPhase = 0;
  for (const phase of phases) {
    if (phase.id === currentPhaseId) {
      const weekInPhase = weeksSinceStart - weeksBeforeCurrentPhase + 1;
      return weekInPhase > 0 ? weekInPhase : null;
    }
    weeksBeforeCurrentPhase += phase.lengthWeeks;
  }
  return null;
}

function buildWorkoutProgramView(
  programName: string,
  phases: PhaseLike[],
  currentPhaseId: string,
  weekInPhase: number | null,
  sessionsPerWeek: number | null,
  planPhaseFocus: string | null
): WorkoutProgramView | null {
  const currentIndex = phases.findIndex((p) => p.id === currentPhaseId);
  const currentPhase = currentIndex >= 0 ? phases[currentIndex] : null;
  if (!currentPhase) return null;
  return {
    programName,
    sessionsPerWeek,
    phaseName: currentPhase.name,
    phaseFocus: currentPhase.focus ?? planPhaseFocus,
    weekInPhase,
    lengthWeeks: currentPhase.lengthWeeks,
    phaseNumber: currentIndex + 1,
    totalPhases: phases.length,
    isFinalPhase: currentPhase.isFinal,
    nextPhaseName: currentPhase.isFinal ? null : (phases[currentIndex + 1]?.name ?? null),
  };
}

export async function GET(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  const weekDates = getWeekDates(todayDateString());
  const { data: planRow } = await supabase
    .from("workout_plans")
    .select(
      "program_id, program_phase_id, template_id, template_phase_id, trainer_program_id, trainer_program_phase_id, phase_week_number, sessions_per_week, phase_focus"
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .gte("week_start", weekDates[0])
    .lte("week_start", weekDates[6])
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  let workoutProgram: WorkoutProgramView | null = null;

  if (planRow?.program_id && planRow?.program_phase_id) {
    const [{ data: programRow }, phases] = await Promise.all([
      supabase.from("training_programs").select("name").eq("id", planRow.program_id).maybeSingle(),
      getPhasesForProgram(planRow.program_id, supabase),
    ]);
    if (programRow) {
      workoutProgram = buildWorkoutProgramView(
        programRow.name,
        phases,
        planRow.program_phase_id,
        planRow.phase_week_number,
        planRow.sessions_per_week,
        planRow.phase_focus
      );
    }
  } else if (planRow?.template_id && planRow?.template_phase_id) {
    const [{ data: templateRow }, { data: phaseRows }] = await Promise.all([
      supabase.from("program_templates").select("name").eq("id", planRow.template_id).maybeSingle(),
      supabase.from("template_phases").select("*").eq("template_id", planRow.template_id).order("phase_order", { ascending: true }),
    ]);
    if (templateRow) {
      const phases: PhaseLike[] = (phaseRows ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        focus: p.focus,
        lengthWeeks: p.length_weeks,
        isFinal: p.is_final,
      }));
      workoutProgram = buildWorkoutProgramView(
        templateRow.name,
        phases,
        planRow.template_phase_id,
        planRow.phase_week_number,
        planRow.sessions_per_week,
        planRow.phase_focus
      );
    }
  } else if (planRow?.trainer_program_id && planRow?.trainer_program_phase_id) {
    const [{ data: programRow }, { data: phaseRows }, { data: assignmentRow }] = await Promise.all([
      supabase.from("trainer_programs").select("name").eq("id", planRow.trainer_program_id).maybeSingle(),
      supabase
        .from("trainer_program_phases")
        .select("*")
        .eq("program_id", planRow.trainer_program_id)
        .order("phase_order", { ascending: true }),
      supabase
        .from("trainer_program_assignments")
        .select("starts_on")
        .eq("client_id", userId)
        .eq("program_id", planRow.trainer_program_id)
        .eq("status", "active")
        .maybeSingle(),
    ]);
    if (programRow) {
      const phases: PhaseLike[] = (phaseRows ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        focus: p.focus,
        lengthWeeks: p.length_weeks,
        isFinal: p.is_final,
      }));
      const weekInPhase = assignmentRow
        ? computeWeekInCurrentPhase(assignmentRow.starts_on, phases, planRow.trainer_program_phase_id, todayDateString())
        : null;
      workoutProgram = buildWorkoutProgramView(
        programRow.name,
        phases,
        planRow.trainer_program_phase_id,
        weekInPhase,
        planRow.sessions_per_week,
        planRow.phase_focus
      );
    }
  }

  const { data: lifePhaseRow } = await supabase
    .from("phases")
    .select("name, mission, starts_on, goal_id")
    .eq("user_id", userId)
    .eq("is_current", true)
    .maybeSingle();

  let lifePhase = null;
  if (lifePhaseRow) {
    let goalOutcome: string | null = null;
    if (lifePhaseRow.goal_id) {
      const { data: goalRow } = await supabase.from("goals").select("outcome").eq("id", lifePhaseRow.goal_id).maybeSingle();
      goalOutcome = goalRow?.outcome ?? null;
    }
    lifePhase = {
      name: lifePhaseRow.name,
      mission: lifePhaseRow.mission,
      startsOn: lifePhaseRow.starts_on,
      goalOutcome,
    };
  }

  return NextResponse.json({ lifePhase, workoutProgram });
}
