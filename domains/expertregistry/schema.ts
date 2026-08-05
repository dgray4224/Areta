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
