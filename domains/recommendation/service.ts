"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/platform/supabase/server";
import type { Database } from "@/platform/db/types";
import type { ExerciseInput } from "@/domains/exercise/schema";
import type { WorkoutPlanDay } from "@/domains/workoutplan/generate";
import { getAllExercises } from "@/domains/exerciselibrary/service";
import { selectTemplate } from "@/domains/recommendation/select-template";
import { fillSessionSlots } from "@/domains/recommendation/fill-slots";
import { prescribeSlot } from "@/domains/recommendation/prescribe";
import { resolveTemplateProgression, type LastTemplatePlanInfo } from "@/domains/recommendation/progression";
import type {
  HydratedTemplatePhase,
  ItemProvenance,
  LimitationRule,
  ProgramTemplate,
  SlotAlternative,
  TemplatePhase,
} from "@/domains/recommendation/types";

/** Per-item engine metadata the caller persists alongside each
 * workout_plan_items row, keyed by (dayOfWeek, session_order). */
export type ItemExtras = {
  templateSlotId: string;
  provenance: ItemProvenance;
  alternatives: SlotAlternative[];
};

export type GoalFirstPlanResult = {
  days: WorkoutPlanDay[];
  extras: Map<string, ItemExtras>;
  warnings: string[];
  templateId: string;
  templatePhaseId: string;
  phaseWeekNumber: number;
  phaseFocus: string | null;
};

function mapTemplate(row: Database["public"]["Tables"]["program_templates"]["Row"]): ProgramTemplate {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    goal: row.goal as ProgramTemplate["goal"],
    experienceTier: row.experience_tier as ProgramTemplate["experienceTier"],
    daysPerWeekMin: row.days_per_week_min,
    daysPerWeekMax: row.days_per_week_max,
    sessionDurationBand: row.session_duration_band as ProgramTemplate["sessionDurationBand"],
    equipmentContext: row.equipment_context as ProgramTemplate["equipmentContext"],
  };
}

function mapPhase(row: Database["public"]["Tables"]["template_phases"]["Row"]): TemplatePhase {
  return {
    id: row.id,
    templateId: row.template_id,
    phaseOrder: row.phase_order,
    name: row.name,
    focus: row.focus,
    lengthWeeks: row.length_weeks,
    intensityStyle: row.intensity_style,
    isFinal: row.is_final,
  };
}

async function getHydratedTemplatePhase(
  phaseId: string,
  supabase: SupabaseClient<Database>
): Promise<HydratedTemplatePhase | null> {
  const { data: phaseRow } = await supabase.from("template_phases").select("*").eq("id", phaseId).maybeSingle();
  if (!phaseRow) return null;

  const { data: sessionRows } = await supabase
    .from("template_sessions")
    .select("*")
    .eq("phase_id", phaseId)
    .order("session_index", { ascending: true });

  const sessionIds = (sessionRows ?? []).map((s) => s.id);
  const { data: slotRows } = sessionIds.length
    ? await supabase.from("template_slots").select("*").in("session_id", sessionIds).order("slot_order", { ascending: true })
    : { data: [] };

  type SlotRow = Database["public"]["Tables"]["template_slots"]["Row"];
  const slotsBySession = new Map<string, SlotRow[]>();
  for (const slot of (slotRows ?? []) as SlotRow[]) {
    const list = slotsBySession.get(slot.session_id) ?? [];
    list.push(slot);
    slotsBySession.set(slot.session_id, list);
  }

  return {
    ...mapPhase(phaseRow),
    sessions: (sessionRows ?? []).map((s) => ({
      id: s.id,
      phaseId: s.phase_id,
      sessionIndex: s.session_index,
      name: s.name,
      sessionType: s.session_type,
      slots: (slotsBySession.get(s.id) ?? []).map((slot) => ({
        id: slot.id,
        sessionId: slot.session_id,
        slotOrder: slot.slot_order,
        slotLabel: slot.slot_label,
        movementPattern: slot.movement_pattern,
        modality: slot.modality as "resistance" | "aerobic" | "mobility" | "power",
        setsMin: slot.sets_min,
        setsMax: slot.sets_max,
        repsMin: slot.reps_min,
        repsMax: slot.reps_max,
        effortTarget: slot.effort_target,
        restSeconds: slot.rest_seconds,
        durationMinutesMin: slot.duration_minutes_min,
        durationMinutesMax: slot.duration_minutes_max,
        coachingNotes: slot.coaching_notes,
      })),
    })),
  };
}

/**
 * The goal-first weekly plan generator — the engine 0044's schema was
 * built for. Deterministic (CLAUDE.md rule 6): template selection,
 * slot-filling, and prescription are pure functions over the user's
 * onboarding answers, the seeded template matrix, and the enriched
 * exercise library; provenance (claim ids, score breakdowns,
 * relaxations) is attached to every item.
 *
 * Reads weekly_adaptation_responses defensively (never auto-progresses
 * volume after reported significant pain or a mostly-missed week);
 * the full adaptation loop (check-in UI + auto-regulation) is the
 * planned follow-up pass.
 */
export async function generateGoalFirstPlan(
  userId: string,
  exercise: ExerciseInput,
  sessionsPerWeek: number,
  weekStart: string,
  client?: SupabaseClient<Database>
): Promise<{ ok: true; data: GoalFirstPlanResult } | { ok: false; error: string }> {
  const supabase = client ?? (await createClient());
  const warnings: string[] = [];

  const [{ data: templateRows }, { data: lastPlanRow }, { data: ruleRows }, exercises, { data: recentItems }, { data: adaptation }] =
    await Promise.all([
      supabase.from("program_templates").select("*").eq("is_active", true),
      supabase
        .from("workout_plans")
        .select("template_id, template_phase_id, phase_week_number, week_start")
        .eq("user_id", userId)
        .not("template_id", "is", null)
        .lt("week_start", weekStart)
        .order("week_start", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("limitation_rules")
        .select("limitation_tag, action, movement_pattern, substitute_movement_pattern, rationale")
        .eq("status", "approved"),
      getAllExercises(client),
      supabase
        .from("workout_plan_items")
        .select("exercise_id, workout_plans!inner(user_id, week_start)")
        .eq("workout_plans.user_id", userId)
        .gte("workout_plans.week_start", isoDaysAgo(weekStart, 21)),
      supabase
        .from("weekly_adaptation_responses")
        .select("planned_sessions_completed, pain_or_discomfort")
        .eq("user_id", userId)
        .not("submitted_at", "is", null)
        .order("week_start", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const templates = (templateRows ?? []).map(mapTemplate);
  const limitationRules: LimitationRule[] = (ruleRows ?? []).map((r) => ({
    limitationTag: r.limitation_tag,
    action: r.action as LimitationRule["action"],
    movementPattern: r.movement_pattern,
    substituteMovementPattern: r.substitute_movement_pattern,
    rationale: r.rationale,
  }));

  // --- progression: continue / advance / reselect --------------------
  let lastPlan: LastTemplatePlanInfo | null = null;
  let currentPhase: TemplatePhase | null = null;
  let nextPhase: TemplatePhase | null = null;
  if (lastPlanRow?.template_id && lastPlanRow.template_phase_id && lastPlanRow.phase_week_number !== null) {
    const lastTemplate = templates.find((t) => t.id === lastPlanRow.template_id);
    const { data: phaseRow } = await supabase
      .from("template_phases")
      .select("*")
      .eq("id", lastPlanRow.template_phase_id)
      .maybeSingle();
    if (lastTemplate && phaseRow) {
      currentPhase = mapPhase(phaseRow);
      const { data: nextRow } = await supabase
        .from("template_phases")
        .select("*")
        .eq("template_id", currentPhase.templateId)
        .gt("phase_order", currentPhase.phaseOrder)
        .order("phase_order", { ascending: true })
        .limit(1)
        .maybeSingle();
      nextPhase = nextRow ? mapPhase(nextRow) : null;
      lastPlan = {
        templateId: lastPlanRow.template_id,
        templateGoal: lastTemplate.goal,
        phaseId: lastPlanRow.template_phase_id,
        phaseWeekNumber: lastPlanRow.phase_week_number,
        weekStart: lastPlanRow.week_start,
      };
    }
  }

  const decision = resolveTemplateProgression({
    lastPlan,
    currentGoal: exercise.primaryGoal,
    newWeekStart: weekStart,
    currentPhase,
    nextPhase,
  });

  let templateId: string;
  let phaseId: string;
  let phaseWeekNumber: number;
  let tier: "beginner" | "intermediate" | "advanced";

  if (decision.kind === "continue_phase" || decision.kind === "advance_phase") {
    templateId = decision.templateId;
    phaseId = decision.phaseId;
    phaseWeekNumber = decision.kind === "continue_phase" ? decision.weekNumber : 1;
    const template = templates.find((t) => t.id === templateId);
    tier = template?.experienceTier ?? "beginner";
  } else {
    const { data: usedRows } = await supabase
      .from("workout_plans")
      .select("template_id")
      .eq("user_id", userId)
      .not("template_id", "is", null);
    const selection = selectTemplate({
      userId,
      exercise,
      templates,
      usedTemplateIds: (usedRows ?? []).map((r) => r.template_id!).filter(Boolean),
    });
    warnings.push(...selection.warnings);
    if (!selection.template) {
      return { ok: false, error: "Choose a primary training goal in onboarding before generating a workout plan." };
    }
    templateId = selection.template.id;
    tier = selection.tier;
    const { data: firstPhase } = await supabase
      .from("template_phases")
      .select("id")
      .eq("template_id", templateId)
      .order("phase_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!firstPhase) return { ok: false, error: "The selected template has no phases — content issue, please report this." };
    phaseId = firstPhase.id;
    phaseWeekNumber = 1;
  }

  const phase = await getHydratedTemplatePhase(phaseId, supabase);
  if (!phase || phase.sessions.length === 0) {
    return { ok: false, error: "The selected template phase has no sessions — content issue, please report this." };
  }

  // --- defensive adaptation hold ------------------------------------
  let effectiveWeek = phaseWeekNumber;
  if (adaptation) {
    const badPain = adaptation.pain_or_discomfort === "significant";
    const mostlyMissed =
      adaptation.planned_sessions_completed !== null && adaptation.planned_sessions_completed < Math.ceil(sessionsPerWeek / 2);
    if ((badPain || mostlyMissed) && phaseWeekNumber > 1) {
      effectiveWeek = phaseWeekNumber - 1;
      warnings.push(
        badPain
          ? "Volume held at last week's level — you reported significant pain, so nothing progresses until that settles."
          : "Volume held at last week's level — most of last week's sessions were missed, so the ramp pauses instead of stacking."
      );
    }
  }

  // --- fill + prescribe, spread across the week ----------------------
  const recentUseCounts = new Map<string, number>();
  for (const item of recentItems ?? []) {
    recentUseCounts.set(item.exercise_id, (recentUseCounts.get(item.exercise_id) ?? 0) + 1);
  }

  const { data: claimRows } = await supabase
    .from("expert_claims")
    .select("id, topic")
    .eq("review_status", "approved")
    .contains("applicable_goals", [exercise.primaryGoal ?? ""]);
  const aerobicTopics = new Set(["polarized_intensity_distribution", "easy_mileage_plus_long_run", "aerobic_weekly_dose", "start_low_go_slow", "weekly_volume_increase_cap"]);
  const claimIdsByTopicGroup = {
    resistance: (claimRows ?? []).filter((c) => !aerobicTopics.has(c.topic)).map((c) => c.id),
    aerobic: (claimRows ?? []).filter((c) => aerobicTopics.has(c.topic)).map((c) => c.id),
  };

  const daysInWeek = 7;
  const cappedSessions = Math.max(0, Math.min(sessionsPerWeek, daysInWeek));
  const sessionDayIndices: number[] = [];
  if (cappedSessions > 0) {
    const gap = daysInWeek / cappedSessions;
    for (let i = 0; i < cappedSessions; i++) sessionDayIndices.push(Math.floor(i * gap));
  }

  const days: WorkoutPlanDay[] = [];
  const extras = new Map<string, ItemExtras>();
  let sessionCursor = 0;
  const fillWarnings = new Set<string>();

  for (let day = 0; day < daysInWeek; day++) {
    if (!sessionDayIndices.includes(day)) {
      days.push({ dayOfWeek: day, isRestDay: true, exercises: [] });
      continue;
    }
    const session = phase.sessions[sessionCursor % phase.sessions.length];
    sessionCursor++;

    const { filled, warnings: sessionWarnings } = fillSessionSlots({
      userId,
      tier,
      slots: session.slots,
      exercises,
      exercise,
      limitationRules,
      recentUseCounts,
      claimIdsByTopicGroup,
    });
    for (const w of sessionWarnings) fillWarnings.add(w);

    const planned = filled.map((f, index) => {
      extras.set(`${day}:${index}`, {
        templateSlotId: f.slot.id,
        provenance: f.provenance,
        alternatives: f.alternatives,
      });
      return prescribeSlot(f, { lengthWeeks: phase.lengthWeeks }, effectiveWeek);
    });

    days.push({ dayOfWeek: day, isRestDay: false, exercises: planned });
  }
  warnings.push(...fillWarnings);

  return {
    ok: true,
    data: {
      days,
      extras,
      warnings,
      templateId,
      templatePhaseId: phaseId,
      phaseWeekNumber,
      phaseFocus: phase.focus,
    },
  };
}

function isoDaysAgo(fromIsoDate: string, days: number): string {
  const d = new Date(`${fromIsoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
