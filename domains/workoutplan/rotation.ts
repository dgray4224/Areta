import type { ExperienceLevel } from "@/domains/exercise/schema";
import type { TrainingProgram, TrainingProgramPhase } from "@/domains/trainingprogram/types";

const EXPERIENCE_RANK: Record<ExperienceLevel, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

/** A user starting a fresh program after more than this many days since
 * their last plan is treated the same as having no history -- their
 * fitness/schedule has likely drifted enough that resuming mid-phase
 * wouldn't make sense. */
const PROGRAM_GAP_THRESHOLD_DAYS = 21;

function hasEquipment(required: string[], equipmentAccess: string[]): boolean {
  const wildcard = equipmentAccess.includes("Full gym access");
  return required.every((eq) => wildcard || equipmentAccess.includes(eq));
}

/** Simple deterministic string hash (djb2-style) -- used instead of
 * Math.random() so the same user/archetype pairing resolves to the same
 * program choice if selection runs more than once before being saved
 * (e.g. a regenerate-before-approve flow). */
function stableHash(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function daysBetween(fromIsoDate: string, toIsoDate: string): number {
  const from = new Date(`${fromIsoDate}T00:00:00Z`).getTime();
  const to = new Date(`${toIsoDate}T00:00:00Z`).getTime();
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

export type SelectProgramInput = {
  userId: string;
  archetype: string;
  /** Active programs for this archetype (domains/trainingprogram/service.ts's
   * getEligibleProgramCandidates) -- unfiltered by equipment/experience/
   * session-count, since that relaxation happens here. */
  candidates: TrainingProgram[];
  equipmentAccess: string[];
  experienceLevel: ExperienceLevel;
  sessionsPerWeek: number;
  /** Distinct program_ids the user has already completed a plan from,
   * for this archetype (from workout_plans history). */
  usedProgramIds: string[];
  /** Most recent week_start the user was on each program_id -- used to
   * break ties when every program has been used at least once. */
  lastUsedByProgramId?: Map<string, string>;
};

export type SelectProgramResult = {
  program: TrainingProgram | null;
  warnings: string[];
};

/**
 * Deterministic program selection with progressive relaxation (mirrors
 * domains/workoutplan/generate.ts's archetype-then-equipment relaxation):
 * try experience+equipment+session-range matched programs first, relax
 * one dimension at a time rather than failing outright. Among the
 * eligible pool, exclude programs the user has already completed; if
 * every eligible program has been used, fall back to whichever was used
 * least recently. Selection among remaining ties is by a stable hash of
 * userId+archetype, not Math.random(), so it's reproducible.
 */
export function selectProgram(input: SelectProgramInput): SelectProgramResult {
  const { userId, archetype, candidates, equipmentAccess, experienceLevel, sessionsPerWeek, usedProgramIds, lastUsedByProgramId } = input;
  const warnings: string[] = [];

  if (candidates.length === 0) {
    return { program: null, warnings: ["No training programs exist yet for this archetype."] };
  }

  const expRank = EXPERIENCE_RANK[experienceLevel];
  const matchesSessions = (p: TrainingProgram) => sessionsPerWeek >= p.sessionsPerWeekMin && sessionsPerWeek <= p.sessionsPerWeekMax;
  const matchesEquipment = (p: TrainingProgram) => hasEquipment(p.equipmentRequired, equipmentAccess);
  const matchesExperience = (p: TrainingProgram) => p.experienceLevel === null || EXPERIENCE_RANK[p.experienceLevel] <= expRank;

  let pool = candidates.filter((p) => matchesEquipment(p) && matchesSessions(p) && matchesExperience(p));

  if (pool.length === 0) {
    warnings.push("No program matched your experience level at your weekly session count -- relaxing the experience-level requirement.");
    pool = candidates.filter((p) => matchesEquipment(p) && matchesSessions(p));
  }

  if (pool.length === 0) {
    warnings.push("No program matched your weekly session count -- showing equipment-matched programs regardless of session count.");
    pool = candidates.filter((p) => matchesEquipment(p));
  }

  if (pool.length === 0) {
    warnings.push("No program matched your equipment access -- showing every program for this archetype.");
    pool = candidates;
  }

  let eligiblePool = pool.filter((p) => !usedProgramIds.includes(p.id));

  if (eligiblePool.length === 0) {
    warnings.push("You've completed every available program for this archetype at least once -- rotating to the one you've done least recently.");
    let oldestDate: string | null = null;
    for (const p of pool) {
      const lastUsed = lastUsedByProgramId?.get(p.id) ?? null;
      if (oldestDate === null || (lastUsed !== null && lastUsed < oldestDate)) {
        oldestDate = lastUsed;
      }
    }
    eligiblePool = pool.filter((p) => (lastUsedByProgramId?.get(p.id) ?? null) === oldestDate);
    if (eligiblePool.length === 0) eligiblePool = pool;
  }

  const chosenIndex = stableHash(`${userId}:${archetype}`) % eligiblePool.length;
  return { program: eligiblePool[chosenIndex], warnings };
}

export type LastWorkoutPlanInfo = {
  programId: string;
  programArchetype: string;
  phaseId: string;
  phaseWeekNumber: number;
  weekStart: string;
};

export type ProgressionDecision =
  | { kind: "select_new_program"; reason: "no_history" | "archetype_changed" | "long_gap" | "program_completed" }
  | { kind: "continue_phase"; programId: string; phaseId: string; weekNumber: number }
  | { kind: "advance_phase"; programId: string; phaseId: string };

export type ResolveProgressionInput = {
  lastPlan: LastWorkoutPlanInfo | null;
  currentArchetype: string;
  newWeekStart: string;
  /** The phase lastPlan.phaseId refers to -- required whenever lastPlan is
   * non-null (fetched by the caller via trainingprogram/service.ts). */
  currentPhase: TrainingProgramPhase | null;
  /** The phase immediately following currentPhase in the same program, if
   * one exists (fetched by the caller via getNextPhase). */
  nextPhase: TrainingProgramPhase | null;
};

/**
 * Decides whether a new week continues the user's current program phase,
 * advances to the next phase, or requires selecting a new program
 * entirely -- pure and DB-free so it's unit-testable with hand-built
 * fixtures, mirroring generate.ts. The caller resolves a
 * "select_new_program" decision by calling selectProgram() and starting
 * at that program's first phase.
 */
export function resolveProgression(input: ResolveProgressionInput): ProgressionDecision {
  const { lastPlan, currentArchetype, newWeekStart, currentPhase, nextPhase } = input;

  if (!lastPlan || !currentPhase) {
    return { kind: "select_new_program", reason: "no_history" };
  }

  if (lastPlan.programArchetype !== currentArchetype) {
    return { kind: "select_new_program", reason: "archetype_changed" };
  }

  if (daysBetween(lastPlan.weekStart, newWeekStart) > PROGRAM_GAP_THRESHOLD_DAYS) {
    return { kind: "select_new_program", reason: "long_gap" };
  }

  const weeksRemainingInPhase = currentPhase.lengthWeeks - lastPlan.phaseWeekNumber;
  if (weeksRemainingInPhase > 0) {
    return {
      kind: "continue_phase",
      programId: lastPlan.programId,
      phaseId: lastPlan.phaseId,
      weekNumber: lastPlan.phaseWeekNumber + 1,
    };
  }

  if (currentPhase.isFinal || !nextPhase) {
    return { kind: "select_new_program", reason: "program_completed" };
  }

  return { kind: "advance_phase", programId: lastPlan.programId, phaseId: nextPhase.id };
}
