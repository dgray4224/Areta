"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/platform/supabase/server";
import { requireAdmin } from "@/platform/auth/admin";
import { logAdminAction } from "@/platform/audit/log";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";
import {
  expertSchema,
  sourceSchema,
  expertClaimSchema,
  limitationRuleSchema,
  evidenceBundleSchema,
} from "@/domains/expertregistry/schema";
import type {
  Expert,
  ExpertStatus,
  Source,
  ExpertClaim,
  ReviewStatus,
  LimitationRule,
  AdminDashboardCounts,
  EvidenceItem,
} from "@/domains/expertregistry/types";

// ---------------------------------------------------------------------------
// Experts
// ---------------------------------------------------------------------------

function toExpert(row: Database["public"]["Tables"]["experts"]["Row"]): Expert {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    entityType: row.entity_type as Expert["entityType"],
    roles: row.roles,
    specialties: row.specialties,
    status: row.status as ExpertStatus,
    inclusionReason: row.inclusion_reason,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}

export async function listExperts(
  status?: ExpertStatus,
  client?: SupabaseClient<Database>
): Promise<Expert[]> {
  const supabase = client ?? (await createClient());
  let query = supabase.from("experts").select("*").order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load experts: ${error.message}`);
  return (data ?? []).map(toExpert);
}

export async function getExpert(id: string, client?: SupabaseClient<Database>): Promise<Expert | null> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase.from("experts").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Failed to load expert: ${error.message}`);
  return data ? toExpert(data) : null;
}

export async function createExpert(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = expertSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("experts")
    .insert({
      name: parsed.data.name,
      slug: parsed.data.slug,
      entity_type: parsed.data.entityType,
      roles: parsed.data.roles,
      specialties: parsed.data.specialties,
      inclusion_reason: parsed.data.inclusionReason || null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { id: data.id } };
}

/** Owner and reviewer accounts both call this — RLS write policy on
 * `experts` keys off `is_admin()`, matching either role (see migration
 * 0044/0052 comments); only the app's own nav/route gating narrows what
 * reviewers can reach. `reviewerId` used to be a caller-supplied argument
 * (RLS still blocked non-admins from writing at all, but let any admin
 * attribute a review to a different admin) — derived from the session via
 * requireAdmin() instead, 2026-08-06, same fix as domains/users/service.ts. */
export async function setExpertStatus(id: string, status: ExpertStatus): Promise<ActionResult> {
  const { user } = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("experts")
    .update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logAdminAction({
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "expert_status_changed",
    targetType: "expert",
    targetId: id,
    detail: { status },
  });

  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

function toSource(
  row: Database["public"]["Tables"]["sources"]["Row"] & { experts?: { name: string } | null }
): Source {
  return {
    id: row.id,
    canonicalUrl: row.canonical_url,
    title: row.title,
    organization: row.organization,
    sourceType: row.source_type as Source["sourceType"],
    expertId: row.expert_id,
    expertName: row.experts?.name ?? null,
    publishedAt: row.published_at,
    accessedAt: row.accessed_at,
    status: row.status as Source["status"],
    createdAt: row.created_at,
  };
}

export async function listSources(client?: SupabaseClient<Database>): Promise<Source[]> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("sources")
    .select("*, experts(name)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to load sources: ${error.message}`);
  return (data ?? []).map(toSource);
}

export async function createSource(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = sourceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sources")
    .insert({
      canonical_url: parsed.data.canonicalUrl,
      title: parsed.data.title,
      organization: parsed.data.organization,
      source_type: parsed.data.sourceType,
      expert_id: parsed.data.expertId || null,
      published_at: parsed.data.publishedAt || null,
      accessed_at: parsed.data.accessedAt,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { id: data.id } };
}

export async function getSource(id: string, client?: SupabaseClient<Database>): Promise<Source | null> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("sources")
    .select("*, experts(name)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load source: ${error.message}`);
  return data ? toSource(data) : null;
}

/** Sources have no review workflow (no reviewed_by/reviewed_at columns —
 * they're reference records, not claims) — just active/archived, same
 * shape as the exercises/recipes retirement mechanism. Added alongside
 * the Evidence-tab merge so every row in the unified list is actionable,
 * not just experts/claims/limitation-rules. */
export async function setSourceStatus(id: string, status: "active" | "archived"): Promise<ActionResult> {
  const { user } = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("sources").update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logAdminAction({
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "source_status_changed",
    targetType: "source",
    targetId: id,
    detail: { status },
  });

  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Expert claims
// ---------------------------------------------------------------------------

function toExpertClaim(
  row: Database["public"]["Tables"]["expert_claims"]["Row"] & {
    experts?: { name: string } | null;
    sources?: { title: string; canonical_url: string } | null;
  }
): ExpertClaim {
  return {
    id: row.id,
    expertId: row.expert_id,
    expertName: row.experts?.name,
    claimType: row.claim_type as ExpertClaim["claimType"],
    topic: row.topic,
    exerciseId: row.exercise_id,
    movementPattern: row.movement_pattern,
    applicableGoals: row.applicable_goals,
    applicableLevels: row.applicable_levels,
    requiredEquipment: row.required_equipment,
    excludedConditions: row.excluded_conditions,
    normalizedClaim: row.normalized_claim,
    shortRationale: row.short_rationale,
    sourceId: row.source_id,
    sourceTitle: row.sources?.title,
    sourceUrl: row.sources?.canonical_url,
    timestampSeconds: row.timestamp_seconds,
    pageNumber: row.page_number,
    verbatimExcerpt: row.verbatim_excerpt,
    confidence: row.confidence as ExpertClaim["confidence"],
    reviewStatus: row.review_status as ReviewStatus,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}

export async function listExpertClaims(
  reviewStatus?: ReviewStatus,
  client?: SupabaseClient<Database>
): Promise<ExpertClaim[]> {
  const supabase = client ?? (await createClient());
  let query = supabase
    .from("expert_claims")
    .select("*, experts(name), sources(title, canonical_url)")
    .order("created_at", { ascending: false });
  if (reviewStatus) query = query.eq("review_status", reviewStatus);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load claims: ${error.message}`);
  return (data ?? []).map(toExpertClaim);
}

export async function getExpertClaim(
  id: string,
  client?: SupabaseClient<Database>
): Promise<ExpertClaim | null> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("expert_claims")
    .select("*, experts(name), sources(title, canonical_url)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load claim: ${error.message}`);
  return data ? toExpertClaim(data) : null;
}

export async function createExpertClaim(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = expertClaimSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expert_claims")
    .insert({
      expert_id: parsed.data.expertId,
      claim_type: parsed.data.claimType,
      topic: parsed.data.topic,
      exercise_id: parsed.data.exerciseId || null,
      movement_pattern: parsed.data.movementPattern || null,
      applicable_goals: parsed.data.applicableGoals,
      applicable_levels: parsed.data.applicableLevels,
      required_equipment: parsed.data.requiredEquipment,
      excluded_conditions: parsed.data.excludedConditions,
      normalized_claim: parsed.data.normalizedClaim,
      short_rationale: parsed.data.shortRationale,
      source_id: parsed.data.sourceId,
      timestamp_seconds: parsed.data.timestampSeconds ?? null,
      page_number: parsed.data.pageNumber ?? null,
      verbatim_excerpt: parsed.data.verbatimExcerpt || null,
      confidence: parsed.data.confidence,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { id: data.id } };
}

export async function reviewExpertClaim(
  id: string,
  status: Extract<ReviewStatus, "approved" | "rejected">
): Promise<ActionResult> {
  const { user } = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("expert_claims")
    .update({ review_status: status, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logAdminAction({
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "expert_claim_reviewed",
    targetType: "expert_claim",
    targetId: id,
    detail: { status },
  });

  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Limitation rules
// ---------------------------------------------------------------------------

function toLimitationRule(
  row: Database["public"]["Tables"]["limitation_rules"]["Row"] & {
    exercises?: { name: string } | null;
    sources?: { title: string } | null;
  }
): LimitationRule {
  return {
    id: row.id,
    limitationTag: row.limitation_tag,
    action: row.action as LimitationRule["action"],
    movementPattern: row.movement_pattern,
    exerciseId: row.exercise_id,
    exerciseName: row.exercises?.name ?? null,
    substituteMovementPattern: row.substitute_movement_pattern,
    rationale: row.rationale,
    sourceId: row.source_id,
    sourceTitle: row.sources?.title ?? null,
    status: row.status as ReviewStatus,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}

export async function listLimitationRules(
  status?: ReviewStatus,
  client?: SupabaseClient<Database>
): Promise<LimitationRule[]> {
  const supabase = client ?? (await createClient());
  let query = supabase
    .from("limitation_rules")
    .select("*, exercises(name), sources(title)")
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load limitation rules: ${error.message}`);
  return (data ?? []).map(toLimitationRule);
}

export async function getLimitationRule(
  id: string,
  client?: SupabaseClient<Database>
): Promise<LimitationRule | null> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from("limitation_rules")
    .select("*, exercises(name), sources(title)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load limitation rule: ${error.message}`);
  return data ? toLimitationRule(data) : null;
}

export async function createLimitationRule(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = limitationRuleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("limitation_rules")
    .insert({
      limitation_tag: parsed.data.limitationTag,
      action: parsed.data.action,
      movement_pattern: parsed.data.movementPattern || null,
      exercise_id: parsed.data.exerciseId || null,
      substitute_movement_pattern: parsed.data.substituteMovementPattern || null,
      rationale: parsed.data.rationale,
      source_id: parsed.data.sourceId || null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { id: data.id } };
}

export async function reviewLimitationRule(
  id: string,
  status: Extract<ReviewStatus, "approved" | "rejected">
): Promise<ActionResult> {
  const { user } = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("limitation_rules")
    .update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logAdminAction({
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "limitation_rule_reviewed",
    targetType: "limitation_rule",
    targetId: id,
    detail: { status },
  });

  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Evidence (unified list across experts/sources/claims/limitation rules —
// the merged Evidence tab, 2026-08-06)
// ---------------------------------------------------------------------------

export async function listEvidence(client?: SupabaseClient<Database>): Promise<EvidenceItem[]> {
  const supabase = client ?? (await createClient());
  const [experts, sources, claims, rules] = await Promise.all([
    listExperts(undefined, supabase),
    listSources(supabase),
    listExpertClaims(undefined, supabase),
    listLimitationRules(undefined, supabase),
  ]);

  const items: EvidenceItem[] = [
    ...experts.map(
      (e): EvidenceItem => ({
        kind: "expert",
        id: e.id,
        title: e.name,
        subtitle: `${e.entityType} · ${e.specialties.join(", ") || "no specialties tagged"}`,
        status: e.status,
        bucket: e.status === "candidate" ? "needs_review" : e.status === "approved" ? "approved" : "other",
        createdAt: e.createdAt,
        href: `/admin/experts/${e.id}`,
      })
    ),
    ...sources.map(
      (s): EvidenceItem => ({
        kind: "source",
        id: s.id,
        title: s.title,
        subtitle: `${s.organization} · ${s.sourceType.replace(/_/g, " ")}${
          s.expertName ? ` · ${s.expertName}` : ""
        }`,
        status: s.status,
        bucket: s.status === "active" ? "approved" : "other",
        createdAt: s.createdAt,
        href: `/admin/sources/${s.id}`,
      })
    ),
    ...claims.map(
      (c): EvidenceItem => ({
        kind: "claim",
        id: c.id,
        title: c.topic,
        subtitle: `${c.expertName ?? "—"} · ${c.claimType.replace(/_/g, " ")}`,
        status: c.reviewStatus,
        bucket:
          c.reviewStatus === "unreviewed" ? "needs_review" : c.reviewStatus === "approved" ? "approved" : "other",
        createdAt: c.createdAt,
        href: `/admin/claims/${c.id}`,
      })
    ),
    ...rules.map(
      (r): EvidenceItem => ({
        kind: "limitation_rule",
        id: r.id,
        title: `${r.limitationTag} → ${r.action}`,
        subtitle: r.exerciseName ?? r.movementPattern ?? "—",
        status: r.status,
        bucket: r.status === "unreviewed" ? "needs_review" : r.status === "approved" ? "approved" : "other",
        createdAt: r.createdAt,
        href: `/admin/limitation-rules/${r.id}`,
      })
    ),
  ];

  return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

// ---------------------------------------------------------------------------
// Evidence bundle (combined Expert + Source + Claim + optional Limitation
// rule submission — the merged Evidence tab, 2026-08-06)
// ---------------------------------------------------------------------------

/** Single coherent submission for the Evidence tab's "+ Add evidence"
 * flow: creates (or reuses) an expert, creates (or reuses) a source,
 * always creates a claim, and optionally creates a limitation rule — all
 * attributed to the same expert/source rather than left for the admin to
 * wire together by hand across four separate forms.
 *
 * Not a real database transaction (the Supabase JS client has no
 * multi-statement transaction primitive over PostgREST) — inserts run
 * sequentially and stop at the first failure. If the claim insert fails
 * after a new expert/source were already created, those rows are simply
 * left behind as reusable records (harmless: pick them via "existing" on
 * retry), not silently rolled back. Every RLS write policy involved here
 * already keys off is_admin(), same as the four functions this replaces. */
export async function createEvidenceBundle(input: unknown): Promise<
  ActionResult<{ expertId: string; sourceId: string; claimId: string; limitationRuleId: string | null }>
> {
  const parsed = evidenceBundleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { user } = await requireAdmin();
  const v = parsed.data;
  const supabase = await createClient();

  let expertId: string;
  if (v.expertMode === "existing") {
    expertId = v.expertId!;
  } else {
    const { data, error } = await supabase
      .from("experts")
      .insert({
        name: v.expertName!,
        slug: v.expertSlug!,
        entity_type: v.expertEntityType!,
        roles: v.expertRoles,
        specialties: v.expertSpecialties,
        inclusion_reason: v.expertInclusionReason || null,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: `Expert: ${error.message}` };
    expertId = data.id;
  }

  let sourceId: string;
  if (v.sourceMode === "existing") {
    sourceId = v.sourceId!;
  } else {
    // expert_id always threads through the resolved expertId above, not
    // anything client-sent — a newly-created source can never end up
    // attributed to a different expert than the one this same submission
    // just created or picked.
    const { data, error } = await supabase
      .from("sources")
      .insert({
        canonical_url: v.sourceCanonicalUrl!,
        title: v.sourceTitle!,
        organization: v.sourceOrganization!,
        source_type: v.sourceType!,
        expert_id: expertId,
        published_at: v.sourcePublishedAt || null,
        accessed_at: v.sourceAccessedAt!,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: `Source: ${error.message}` };
    sourceId = data.id;
  }

  const { data: claim, error: claimError } = await supabase
    .from("expert_claims")
    .insert({
      expert_id: expertId,
      claim_type: v.claimType,
      topic: v.topic,
      exercise_id: v.exerciseId || null,
      movement_pattern: v.movementPattern || null,
      applicable_goals: v.applicableGoals,
      applicable_levels: v.applicableLevels,
      required_equipment: v.requiredEquipment,
      excluded_conditions: v.excludedConditions,
      normalized_claim: v.normalizedClaim,
      short_rationale: v.shortRationale,
      source_id: sourceId,
      timestamp_seconds: v.timestampSeconds ?? null,
      page_number: v.pageNumber ?? null,
      verbatim_excerpt: v.verbatimExcerpt || null,
      confidence: v.confidence,
    })
    .select("id")
    .single();
  if (claimError) return { ok: false, error: `Claim: ${claimError.message}` };

  // Known, confirmed capability gap (2026-08-06, same shape and same
  // resolution as evidenceBundleSchema's expertMode note): source_id is
  // always the bundle's own mandatory source here, even though
  // limitation_rules.source_id is nullable and the deleted
  // LimitationRuleForm let a rule be recorded on internal clinical
  // judgment alone, no citation required. Accepted consequence of
  // authoring a limitation rule only ever as an add-on to a full
  // expert+source+claim bundle now, not a standalone capability —
  // same "fully combined" trade-off already confirmed for bare
  // institutional sources.
  let limitationRuleId: string | null = null;
  if (v.includeLimitationRule) {
    const { data: rule, error: ruleError } = await supabase
      .from("limitation_rules")
      .insert({
        limitation_tag: v.ruleLimitationTag!,
        action: v.ruleAction!,
        movement_pattern: v.ruleMovementPattern || null,
        exercise_id: v.ruleExerciseId || null,
        substitute_movement_pattern: v.ruleSubstituteMovementPattern || null,
        rationale: v.ruleRationale!,
        source_id: sourceId,
      })
      .select("id")
      .single();
    if (ruleError) return { ok: false, error: `Limitation rule: ${ruleError.message}` };
    limitationRuleId = rule.id;
  }

  await logAdminAction({
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "evidence_bundle_created",
    targetType: "expert_claim",
    targetId: claim.id,
    detail: {
      expertId,
      expertMode: v.expertMode,
      sourceId,
      sourceMode: v.sourceMode,
      limitationRuleId,
    },
  });

  return { ok: true, data: { expertId, sourceId, claimId: claim.id, limitationRuleId } };
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function getAdminDashboardCounts(
  client?: SupabaseClient<Database>
): Promise<AdminDashboardCounts> {
  const supabase = client ?? (await createClient());
  const [experts, claims, rules] = await Promise.all([
    supabase.from("experts").select("id", { count: "exact", head: true }).eq("status", "candidate"),
    supabase
      .from("expert_claims")
      .select("id", { count: "exact", head: true })
      .eq("review_status", "unreviewed"),
    supabase.from("limitation_rules").select("id", { count: "exact", head: true }).eq("status", "unreviewed"),
  ]);
  return {
    candidateExperts: experts.count ?? 0,
    unreviewedClaims: claims.count ?? 0,
    unreviewedLimitationRules: rules.count ?? 0,
  };
}
