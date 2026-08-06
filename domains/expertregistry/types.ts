/** Domain types for the admin content-review registry (migration 0044):
 * experts, sources, expert_claims, limitation_rules. This is the
 * evidence base the goal-first training recommendation engine (not yet
 * built — see README "Known gaps") will read from once claims/rules are
 * approved; nothing here is consumed by end-user-facing plans yet. */

export type ExpertStatus = "candidate" | "approved" | "inactive" | "excluded";
export type EntityType = "person" | "institution";

export type Expert = {
  id: string;
  name: string;
  slug: string;
  entityType: EntityType;
  roles: string[];
  specialties: string[];
  status: ExpertStatus;
  inclusionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export type SourceType =
  | "peer_reviewed"
  | "official_expert_content"
  | "long_form_official_video"
  | "official_short_form"
  | "reputable_interview"
  | "third_party_summary"
  | "social_post"
  | "certifying_body"
  | "governing_body";

export type Source = {
  id: string;
  canonicalUrl: string;
  title: string;
  organization: string;
  sourceType: SourceType;
  expertId: string | null;
  expertName?: string | null;
  publishedAt: string | null;
  accessedAt: string;
  status: "active" | "archived";
  createdAt: string;
};

export type ClaimType =
  | "explicit_recommendation"
  | "programming_rule"
  | "technique_cue"
  | "progression_rule"
  | "regression"
  | "caution"
  | "demonstration_only"
  | "inference";

export type ReviewStatus = "unreviewed" | "approved" | "rejected";
export type Confidence = "low" | "medium" | "high";

export type ExpertClaim = {
  id: string;
  expertId: string;
  expertName?: string;
  claimType: ClaimType;
  topic: string;
  exerciseId: string | null;
  movementPattern: string | null;
  applicableGoals: string[];
  applicableLevels: string[];
  requiredEquipment: string[];
  excludedConditions: string[];
  normalizedClaim: string;
  shortRationale: string;
  sourceId: string;
  sourceTitle?: string;
  sourceUrl?: string;
  timestampSeconds: number | null;
  pageNumber: number | null;
  verbatimExcerpt: string | null;
  confidence: Confidence;
  reviewStatus: ReviewStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export type LimitationAction = "exclude" | "substitute" | "manual_review";

export type LimitationRule = {
  id: string;
  limitationTag: string;
  action: LimitationAction;
  movementPattern: string | null;
  exerciseId: string | null;
  exerciseName?: string | null;
  substituteMovementPattern: string | null;
  rationale: string;
  sourceId: string | null;
  sourceTitle?: string | null;
  status: ReviewStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export type AdminDashboardCounts = {
  candidateExperts: number;
  unreviewedClaims: number;
  unreviewedLimitationRules: number;
};

/** Unified row shape for the merged Evidence tab (2026-08-06) — experts,
 * sources, claims, and limitation rules normalized into one list. Each
 * type's own status vocabulary collapses into one shared three-way
 * bucket so a single filter row works across all four:
 *   - needs_review: expert candidate / claim or rule unreviewed
 *   - approved: expert approved / source active / claim or rule approved
 *   - other: expert inactive|excluded / source archived / claim or rule rejected
 * Sources never populate needs_review — they have no review workflow,
 * just active/archived (see setSourceStatus's comment). */
export type EvidenceKind = "expert" | "source" | "claim" | "limitation_rule";
export type EvidenceBucket = "needs_review" | "approved" | "other";

export type EvidenceItem = {
  kind: EvidenceKind;
  id: string;
  title: string;
  subtitle: string;
  status: string;
  bucket: EvidenceBucket;
  createdAt: string;
  href: string;
};
