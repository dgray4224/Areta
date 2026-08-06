import { z } from "zod";

/** Slugify helper shared by the create forms — mirrors the pattern used
 * by the training-content pipeline (`domains/trainingprogram/content-spec.ts`)
 * for consistency, not imported from there since that module is script-side. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** `register(name, { setValueAs: csvToArray })` for a plain text input that
 * represents a comma-separated list — mirrors `optionalNumberValue`/
 * `optionalStringValue` in `platform/ui/FormField.tsx`: the DOM always
 * hands react-hook-form a string, and the array-shaped conversion happens
 * at that boundary rather than inside the Zod schema (a `.transform()`
 * there would give the schema a different input vs. output type, which
 * `zodResolver` can't reconcile against a single `useForm<T>()` generic). */
export function csvToArray(value: string): string[] {
  return value
    ? value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
}

// No `.default([])` here on purpose: `csvToArray` (see below) always
// returns a real array at the react-hook-form boundary, and giving this
// field an optional input type here would make `zodResolver`'s inferred
// input type diverge from `useForm<ExpertInput>()`'s single generic.
const stringArray = z.array(z.string());

export const expertSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
  entityType: z.enum(["person", "institution"]),
  roles: stringArray,
  specialties: stringArray,
  inclusionReason: z.string().optional(),
});
export type ExpertInput = z.infer<typeof expertSchema>;

export const sourceSchema = z.object({
  canonicalUrl: z.string().url("Must be a valid URL"),
  title: z.string().min(1, "Title is required"),
  organization: z.string().min(1, "Organization is required"),
  sourceType: z.enum([
    "peer_reviewed",
    "official_expert_content",
    "long_form_official_video",
    "official_short_form",
    "reputable_interview",
    "third_party_summary",
    "social_post",
    "certifying_body",
    "governing_body",
  ]),
  expertId: z.string().uuid().optional(),
  publishedAt: z.string().optional(),
  accessedAt: z.string().min(1, "Accessed date is required"),
});
export type SourceInput = z.infer<typeof sourceSchema>;

export const expertClaimSchema = z.object({
  expertId: z.string().uuid("Select an expert"),
  claimType: z.enum([
    "explicit_recommendation",
    "programming_rule",
    "technique_cue",
    "progression_rule",
    "regression",
    "caution",
    "demonstration_only",
    "inference",
  ]),
  topic: z.string().min(1, "Topic is required"),
  exerciseId: z.string().uuid().optional(),
  movementPattern: z.string().optional(),
  applicableGoals: stringArray,
  applicableLevels: stringArray,
  requiredEquipment: stringArray,
  excludedConditions: stringArray,
  normalizedClaim: z.string().min(1, "Normalized claim is required"),
  shortRationale: z.string().min(1, "Short rationale is required"),
  sourceId: z.string().uuid("Select a source"),
  timestampSeconds: z.number().int().min(0).optional(),
  pageNumber: z.number().int().min(1).optional(),
  verbatimExcerpt: z.string().optional(),
  confidence: z.enum(["low", "medium", "high"]),
});

export type ExpertClaimInput = z.infer<typeof expertClaimSchema>;

export const limitationRuleSchema = z
  .object({
    limitationTag: z.string().min(1, "Limitation tag is required"),
    action: z.enum(["exclude", "substitute", "manual_review"]),
    movementPattern: z.string().optional(),
    exerciseId: z.string().uuid().optional(),
    substituteMovementPattern: z.string().optional(),
    rationale: z.string().min(1, "Rationale is required"),
    sourceId: z.string().uuid().optional(),
  })
  .refine((v) => !(v.movementPattern && v.exerciseId), {
    message: "Target either a movement pattern or a specific exercise, not both",
    path: ["movementPattern"],
  });
export type LimitationRuleInput = z.infer<typeof limitationRuleSchema>;

/** The combined "Evidence" intake form (admin portal Evidence tab, merged
 * 2026-08-06 from four separate Experts/Sources/Claims/Limitation-rules
 * forms into one coherent submission): expert + source + claim, with an
 * optional limitation rule, in a single flat shape react-hook-form can
 * register() directly against. Deliberately flat (expertName/sourceTitle/
 * etc. prefixed rather than nested objects) rather than nested — nested
 * shapes fight react-hook-form's dot-path field registration for no real
 * benefit here.
 *
 * "Coherent" is enforced two ways: (1) superRefine below requires exactly
 * the fields the chosen expert/source/rule mode needs and nothing it
 * doesn't; (2) createEvidenceBundle (service.ts) ignores any client-sent
 * expertId on the new source/rule and always threads through the
 * server-resolved one, so a newly-created source can never end up
 * attributed to the wrong expert.
 *
 * Known, confirmed capability gap (2026-08-06 code-review pass): unlike
 * the deleted standalone SourceForm, expertMode is never optional here —
 * every submission requires an expert, so a bare institutional-only
 * source (e.g. citing an ACSM guideline with no individual expert) can't
 * be added through this flow. Raised with the user and confirmed to
 * leave as-is: expert_claims.expertId was already mandatory before this
 * merge, so the practical loss is narrow, and it's an accepted
 * consequence of the explicit "fully combined" choice this schema
 * implements, not an oversight. */
export const evidenceBundleSchema = z
  .object({
    expertMode: z.enum(["existing", "new"]),
    expertId: z.string().uuid().optional(),
    expertName: z.string().optional(),
    expertSlug: z.string().optional(),
    expertEntityType: z.enum(["person", "institution"]).optional(),
    expertRoles: stringArray,
    expertSpecialties: stringArray,
    expertInclusionReason: z.string().optional(),

    sourceMode: z.enum(["existing", "new"]),
    sourceId: z.string().uuid().optional(),
    sourceTitle: z.string().optional(),
    sourceCanonicalUrl: z.string().optional(),
    sourceOrganization: z.string().optional(),
    sourceType: z
      .enum([
        "peer_reviewed",
        "official_expert_content",
        "long_form_official_video",
        "official_short_form",
        "reputable_interview",
        "third_party_summary",
        "social_post",
        "certifying_body",
        "governing_body",
      ])
      .optional(),
    sourcePublishedAt: z.string().optional(),
    sourceAccessedAt: z.string().optional(),

    claimType: z.enum([
      "explicit_recommendation",
      "programming_rule",
      "technique_cue",
      "progression_rule",
      "regression",
      "caution",
      "demonstration_only",
      "inference",
    ]),
    topic: z.string().min(1, "Topic is required"),
    exerciseId: z.string().uuid().optional(),
    movementPattern: z.string().optional(),
    applicableGoals: stringArray,
    applicableLevels: stringArray,
    requiredEquipment: stringArray,
    excludedConditions: stringArray,
    normalizedClaim: z.string().min(1, "Normalized claim is required"),
    shortRationale: z.string().min(1, "Short rationale is required"),
    timestampSeconds: z.number().int().min(0).optional(),
    pageNumber: z.number().int().min(1).optional(),
    verbatimExcerpt: z.string().optional(),
    confidence: z.enum(["low", "medium", "high"]),

    includeLimitationRule: z.boolean(),
    ruleLimitationTag: z.string().optional(),
    ruleAction: z.enum(["exclude", "substitute", "manual_review"]).optional(),
    ruleMovementPattern: z.string().optional(),
    ruleExerciseId: z.string().uuid().optional(),
    ruleSubstituteMovementPattern: z.string().optional(),
    ruleRationale: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.expertMode === "existing" && !v.expertId) {
      ctx.addIssue({ code: "custom", path: ["expertId"], message: "Select an expert" });
    }
    if (v.expertMode === "new") {
      if (!v.expertName) ctx.addIssue({ code: "custom", path: ["expertName"], message: "Name is required" });
      if (!v.expertSlug) ctx.addIssue({ code: "custom", path: ["expertSlug"], message: "Slug is required" });
      if (!v.expertEntityType)
        ctx.addIssue({ code: "custom", path: ["expertEntityType"], message: "Entity type is required" });
    }
    if (v.sourceMode === "existing" && !v.sourceId) {
      ctx.addIssue({ code: "custom", path: ["sourceId"], message: "Select a source" });
    }
    if (v.sourceMode === "new") {
      if (!v.sourceTitle)
        ctx.addIssue({ code: "custom", path: ["sourceTitle"], message: "Title is required" });
      if (!v.sourceCanonicalUrl || !z.string().url().safeParse(v.sourceCanonicalUrl).success)
        ctx.addIssue({
          code: "custom",
          path: ["sourceCanonicalUrl"],
          message: "Must be a valid URL",
        });
      if (!v.sourceOrganization)
        ctx.addIssue({ code: "custom", path: ["sourceOrganization"], message: "Organization is required" });
      if (!v.sourceType)
        ctx.addIssue({ code: "custom", path: ["sourceType"], message: "Source type is required" });
      if (!v.sourceAccessedAt)
        ctx.addIssue({ code: "custom", path: ["sourceAccessedAt"], message: "Accessed date is required" });
    }
    if (v.movementPattern && v.exerciseId) {
      ctx.addIssue({
        code: "custom",
        path: ["movementPattern"],
        message: "Target either a movement pattern or a specific exercise, not both",
      });
    }
    if (v.includeLimitationRule) {
      if (!v.ruleLimitationTag)
        ctx.addIssue({
          code: "custom",
          path: ["ruleLimitationTag"],
          message: "Limitation tag is required",
        });
      if (!v.ruleAction) ctx.addIssue({ code: "custom", path: ["ruleAction"], message: "Action is required" });
      if (!v.ruleRationale)
        ctx.addIssue({ code: "custom", path: ["ruleRationale"], message: "Rationale is required" });
      if (v.ruleMovementPattern && v.ruleExerciseId) {
        ctx.addIssue({
          code: "custom",
          path: ["ruleMovementPattern"],
          message: "Target either a movement pattern or a specific exercise, not both",
        });
      }
    }
  });
export type EvidenceBundleInput = z.infer<typeof evidenceBundleSchema>;
