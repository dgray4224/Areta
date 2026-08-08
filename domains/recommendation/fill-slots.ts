import type { Exercise } from "@/domains/exerciselibrary/types";
import type { ExerciseInput } from "@/domains/exercise/schema";
import { hasEquipment } from "@/domains/workoutplan/generate";
import { stableHash } from "@/domains/recommendation/select-template";
import {
  ACTIVITY_TO_PATTERN,
  AEROBIC_PATTERN_GROUP,
  type ExperienceTier,
  type FilledSlot,
  type LimitationRule,
  type TemplateSlot,
} from "@/domains/recommendation/types";

export type FillSlotsInput = {
  userId: string;
  tier: ExperienceTier;
  slots: TemplateSlot[];
  exercises: Exercise[];
  exercise: ExerciseInput;
  limitationRules: LimitationRule[];
  /** exercise_id -> times used in recent weeks (variety down-ranking). */
  recentUseCounts: Map<string, number>;
  /** Approved claim ids applicable to this user's goal/tier, attached
   * to provenance so every item can point at its evidence. */
  claimIdsByTopicGroup: { resistance: string[]; aerobic: string[] };
};

export type FillSlotsResult = {
  filled: FilledSlot[];
  warnings: string[];
};

const MAX_USES_PER_SESSION_SET = 2; // same variety cap as generate.ts

/**
 * Fills one session's abstract slots with concrete exercises.
 *
 * Hard filters (never relaxed): limitation excludes — both the seeded
 * pattern-level limitation_rules (action='exclude') and per-exercise
 * limitation_tags (0089). Everything else relaxes tier by tier with a
 * warning sooner than producing an empty session.
 *
 * Substitute rules re-target the slot's pattern before matching (e.g.
 * lower_back: hinge -> hip_extension), per the joint_friendly_
 * substitution claim — the stimulus stays, the aggravating pattern goes.
 */
export function fillSessionSlots(input: FillSlotsInput): FillSlotsResult {
  const warnings: string[] = [];
  const filled: FilledSlot[] = [];
  const userTags = new Set<string>(input.exercise.limitationTags ?? []);
  const hasLimitations = input.exercise.injuryStatus && input.exercise.injuryStatus !== "no" && userTags.size > 0;

  const activeRules = hasLimitations ? input.limitationRules.filter((r) => userTags.has(r.limitationTag)) : [];
  const excludedPatterns = new Set(
    activeRules.filter((r) => r.action === "exclude" && r.movementPattern).map((r) => r.movementPattern!)
  );
  const substituteByPattern = new Map(
    activeRules
      .filter((r) => r.action === "substitute" && r.movementPattern && r.substituteMovementPattern)
      .map((r) => [r.movementPattern!, r.substituteMovementPattern!])
  );

  const dislikedPatterns = new Set(
    (input.exercise.dislikedActivities ?? [])
      .map((activity) => ACTIVITY_TO_PATTERN[activity])
      .filter((p): p is string => Boolean(p))
  );
  const preferredPatterns = new Set(
    (input.exercise.preferredActivities ?? [])
      .map((activity) => ACTIVITY_TO_PATTERN[activity])
      .filter((p): p is string => Boolean(p))
  );
  const endurancePreference =
    resolveAerobicPreference(input.exercise.goalDetail?.preferredEnduranceActivity) ??
    resolveAerobicPreference(input.exercise.goalDetail?.eventType);

  const prioritizedMuscles = new Set(input.exercise.goalDetail?.prioritizedMuscleAreas ?? []);
  const equipmentAccess = input.exercise.equipmentAccess ?? [];
  const usedThisSession = new Set<string>();
  const sessionUseCounts = new Map<string, number>();

  for (const slot of input.slots) {
    const relaxations: string[] = [];

    // 1. Substitute-rule pattern re-target.
    let targetPattern = slot.movementPattern;
    const substitute = substituteByPattern.get(targetPattern);
    if (substitute) {
      relaxations.push(`pattern substituted (${targetPattern} -> ${substitute}) for your stated limitation`);
      targetPattern = substitute;
    }

    const isAerobicSlot = (AEROBIC_PATTERN_GROUP as readonly string[]).includes(targetPattern);

    // 2. Safety floor: limitation excludes + beginner high-skill guard.
    //    Never relaxed.
    const safe = input.exercises.filter((e) => {
      if (hasLimitations) {
        if (e.limitationTags.some((tag) => userTags.has(tag))) return false;
        if (e.movementPatterns.some((p) => excludedPatterns.has(p))) return false;
      }
      if (input.tier === "beginner" && e.difficulty === "advanced") return false;
      return true;
    });

    // 3. Pattern match (aerobic slots accept the whole aerobic group,
    //    re-ranked by stated preference below).
    const matchesPattern = (e: Exercise) =>
      isAerobicSlot
        ? e.movementPatterns.some((p) => (AEROBIC_PATTERN_GROUP as readonly string[]).includes(p))
        : e.movementPatterns.includes(targetPattern);

    let pool = safe.filter((e) => matchesPattern(e) && hasEquipment(e, equipmentAccess) && !dislikedFilter(e, dislikedPatterns));
    if (pool.length === 0) {
      const withoutDislikes = safe.filter((e) => matchesPattern(e) && hasEquipment(e, equipmentAccess));
      if (withoutDislikes.length > 0) {
        relaxations.push("included an activity you marked as disliked — nothing else fit this slot");
        pool = withoutDislikes;
      }
    }
    if (pool.length === 0) {
      const withoutEquipment = safe.filter((e) => matchesPattern(e));
      if (withoutEquipment.length > 0) {
        relaxations.push("no equipment-compatible option — pick an alternative or add equipment in settings");
        pool = withoutEquipment;
      }
    }
    if (pool.length === 0) {
      const sameModality = safe.filter((e) => e.modality === slot.modality && hasEquipment(e, equipmentAccess));
      if (sameModality.length > 0) {
        relaxations.push(`no ${targetPattern.replace(/_/g, " ")} option available — widened to any ${slot.modality} exercise`);
        pool = sameModality;
      }
    }
    if (pool.length === 0 && safe.length > 0) {
      relaxations.push("no close match available — chose the best safe option from the whole library");
      pool = safe;
    }
    if (pool.length === 0) {
      warnings.push(`No safe exercise exists for "${slot.slotLabel}" given your limitations — slot skipped.`);
      continue;
    }

    // 4. Score.
    const scoredAll = pool
      .map((e) => {
        const breakdown: Record<string, number> = {};
        breakdown.patternExact = e.movementPatterns.includes(targetPattern) ? 50 : 0;
        if (isAerobicSlot) {
          const preferenceHit =
            (endurancePreference && e.movementPatterns.includes(endurancePreference) ? 50 : 0) +
            (e.movementPatterns.some((p) => preferredPatterns.has(p)) ? 30 : 0);
          breakdown.aerobicPreference = preferenceHit;
        }
        breakdown.compoundFirst = !isAerobicSlot && slot.slotOrder <= 2 && e.compound ? 20 : 0;
        breakdown.difficultyFit =
          e.difficulty === input.tier ? 20 : Math.abs(tierIndex(e.difficulty) - tierIndex(input.tier)) === 1 ? 10 : 0;
        breakdown.musclePriority =
          prioritizedMuscles.size > 0 && e.primaryMuscleGroups.some((m) => prioritizedMuscles.has(m)) ? 25 : 0;
        breakdown.varietyPenalty = -15 * (input.recentUseCounts.get(e.id) ?? 0);
        breakdown.sessionRepeatPenalty = -40 * (sessionUseCounts.get(e.id) ?? 0);
        breakdown.tieBreak = stableHash(`${input.userId}:${slot.id}:${e.id}`) % 8;
        const score = Object.values(breakdown).reduce((a, b) => a + b, 0);
        return { exercise: e, score, breakdown };
      })
      .sort((a, b) => b.score - a.score || a.exercise.id.localeCompare(b.exercise.id));

    // No within-session repeats unless the pool is too small to avoid it.
    const unused = scoredAll.filter(({ exercise }) => !usedThisSession.has(exercise.id));
    const ranked = unused.length > 0 ? unused : scoredAll;
    const winner = ranked[0];
    usedThisSession.add(winner.exercise.id);
    sessionUseCounts.set(winner.exercise.id, Math.min((sessionUseCounts.get(winner.exercise.id) ?? 0) + 1, MAX_USES_PER_SESSION_SET));

    filled.push({
      slot,
      exerciseId: winner.exercise.id,
      provenance: {
        templateSlotId: slot.id,
        slotLabel: slot.slotLabel,
        score: winner.score,
        scoreBreakdown: winner.breakdown,
        claimIds: slot.modality === "aerobic" ? input.claimIdsByTopicGroup.aerobic : input.claimIdsByTopicGroup.resistance,
        relaxations,
      },
      alternatives: ranked
        .slice(1, 3)
        .map((r, i) => ({ exerciseId: r.exercise.id, rank: (i + 1) as 1 | 2, score: r.score })),
    });
  }

  const manualReviewRules = activeRules.filter((r) => r.action === "manual_review");
  for (const rule of manualReviewRules) {
    warnings.push(`Heads up: ${rule.rationale}`);
  }

  return { filled, warnings };
}

function dislikedFilter(e: Exercise, dislikedPatterns: Set<string>): boolean {
  if (dislikedPatterns.size === 0) return false;
  // Only aerobic-type dislikes filter — disliking "strength_training"
  // can't be allowed to hollow out a strength template the user's own
  // goal selected.
  return e.modality === "aerobic" && e.movementPatterns.some((p) => dislikedPatterns.has(p));
}

function tierIndex(tier: "beginner" | "intermediate" | "advanced"): number {
  return tier === "beginner" ? 0 : tier === "intermediate" ? 1 : 2;
}

function resolveAerobicPreference(freeText: string | undefined): string | null {
  if (!freeText) return null;
  const text = freeText.toLowerCase();
  if (/(run|marathon|5k|10k|half|jog|track)/.test(text)) return "run";
  if (/(bike|cycl|ride|gran fondo|century)/.test(text)) return "bike";
  if (/(swim)/.test(text)) return "swim";
  if (/(row|erg)/.test(text)) return "row";
  return null;
}
