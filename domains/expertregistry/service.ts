"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/platform/supabase/server";
import type { Database } from "@/platform/db/types";
import type { ActionResult } from "@/platform/auth/actions";
import {
  expertSchema,
  sourceSchema,
  expertClaimSchema,
  limitationRuleSchema,
} from "@/domains/expertregistry/schema";
import type {
  Expert,
  ExpertStatus,
  Source,
  ExpertClaim,
  ReviewStatus,
  LimitationRule,
  AdminDashboardCounts,
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
 * reviewers can reach. */
export async function setExpertStatus(
  id: string,
  status: ExpertStatus,
  reviewerId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("experts")
    .update({ status, reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
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
  status: Extract<ReviewStatus, "approved" | "rejected">,
  reviewerId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("expert_claims")
    .update({ review_status: status, reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
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
  status: Extract<ReviewStatus, "approved" | "rejected">,
  reviewerId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("limitation_rules")
    .update({ status, reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
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
