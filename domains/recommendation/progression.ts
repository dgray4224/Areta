import type { TemplatePhase, TemplateProgressionDecision } from "@/domains/recommendation/types";

/** Same 21-day gap threshold as workoutplan/rotation.ts — after a long
 * break, restarting fresh beats resuming week 6 of a phase the body has
 * detrained out of. */
const TEMPLATE_GAP_THRESHOLD_DAYS = 21;

export type LastTemplatePlanInfo = {
  templateId: string;
  templateGoal: string;
  phaseId: string;
  phaseWeekNumber: number;
  weekStart: string;
};

export type ResolveTemplateProgressionInput = {
  lastPlan: LastTemplatePlanInfo | null;
  currentGoal: string | undefined;
  newWeekStart: string;
  currentPhase: Pick<TemplatePhase, "id" | "lengthWeeks" | "isFinal"> | null;
  nextPhase: Pick<TemplatePhase, "id"> | null;
};

function daysBetween(fromIsoDate: string, toIsoDate: string): number {
  const from = new Date(`${fromIsoDate}T00:00:00Z`).getTime();
  const to = new Date(`${toIsoDate}T00:00:00Z`).getTime();
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

/**
 * Mirror of rotation.ts#resolveProgression for the template family:
 * continue the current phase week by week, advance to the next phase
 * when this one completes, or select a fresh template when there's no
 * usable history (never trained, goal changed, long gap, or the final
 * phase finished). Pure — the service does all the fetching.
 */
export function resolveTemplateProgression(input: ResolveTemplateProgressionInput): TemplateProgressionDecision {
  const { lastPlan, currentPhase } = input;
  if (!lastPlan || !currentPhase) return { kind: "select_new_template", reason: "no_history" };
  if (input.currentGoal && lastPlan.templateGoal !== input.currentGoal) {
    return { kind: "select_new_template", reason: "inputs_changed" };
  }
  if (daysBetween(lastPlan.weekStart, input.newWeekStart) > TEMPLATE_GAP_THRESHOLD_DAYS) {
    return { kind: "select_new_template", reason: "long_gap" };
  }

  const weeksRemaining = currentPhase.lengthWeeks - lastPlan.phaseWeekNumber;
  if (weeksRemaining > 0) {
    return {
      kind: "continue_phase",
      templateId: lastPlan.templateId,
      phaseId: currentPhase.id,
      weekNumber: lastPlan.phaseWeekNumber + 1,
    };
  }

  if (input.nextPhase) {
    return { kind: "advance_phase", templateId: lastPlan.templateId, phaseId: input.nextPhase.id };
  }

  return { kind: "select_new_template", reason: "template_completed" };
}
