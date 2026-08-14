import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { typeLabelFor } from "@/domains/insights/templates";

const DEFAULT_LIMIT = 50;

/**
 * Bearer-authenticated insight feed (Insight Engine v2, 2026-08-14) — the
 * mobile Review tab's "New about you" section is the first caller. Rows
 * are produced only by the generate-insights cron; this route is
 * read-only. `?status=new` filters to unseen (the default is everything
 * except dismissed, newest first — the feed shows recent history, not
 * just the unread badge set).
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  const statusFilter = request.nextUrl.searchParams.get("status");

  let query = supabase
    .from("insights")
    .select("id, type, grain, period_start, period_end, facts, headline, score, status, seen_at, shared_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(DEFAULT_LIMIT);
  query = statusFilter === "new" ? query.eq("status", "new") : query.neq("status", "dismissed");

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // typeLabel is computed here, not stored -- avoids denormalized data
  // drifting if a type's display label is ever renamed (see
  // typeLabelFor's doc comment).
  const insights = (data ?? []).map((row) => ({ ...row, typeLabel: typeLabelFor(row.type) }));
  return NextResponse.json({ insights });
}

const MAX_BATCH_IDS = 50;

/**
 * Batched status transition for multiple insights in one request — added
 * (2026-08-14, via /code-review on the mobile insight feed) because the
 * feed was marking every newly-loaded insight seen with one PATCH
 * /api/insights/:id call each: N concurrent requests on a normal visit,
 * with any partial failure silently leaving some rows inconsistently
 * seen. Body: `{ "ids": string[], "status": "seen" | "dismissed" }`.
 * Only supports status (not `shared`) — sharing is always a single-card
 * action, batching adds no value there. `seen_at` is only set on rows
 * that don't already have one, same as the single-id route.
 */
export async function PATCH(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  let body: { ids?: unknown; status?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.ids) || body.ids.length === 0 || !body.ids.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "ids must be a non-empty array of strings" }, { status: 400 });
  }
  if (body.ids.length > MAX_BATCH_IDS) {
    return NextResponse.json({ error: `ids must contain at most ${MAX_BATCH_IDS} entries` }, { status: 400 });
  }
  if (body.status !== "seen" && body.status !== "dismissed") {
    return NextResponse.json({ error: "status must be 'seen' or 'dismissed'" }, { status: 400 });
  }

  const ids = body.ids as string[];
  const status = body.status;

  // seen_at is only backfilled for rows that don't already have one --
  // matches the single-id PATCH route's "don't rewrite history on
  // re-view" behavior. Two updates (only-unseen, then everything) rather
  // than a single upsert, since Supabase's query builder has no
  // "SET seen_at = COALESCE(seen_at, now())" expression.
  const now = new Date().toISOString();
  const { error: seenAtError } = await supabase
    .from("insights")
    .update({ seen_at: now })
    .eq("user_id", userId)
    .in("id", ids)
    .is("seen_at", null);
  if (seenAtError) {
    return NextResponse.json({ error: seenAtError.message }, { status: 500 });
  }

  const { error: statusError } = await supabase.from("insights").update({ status }).eq("user_id", userId).in("id", ids);
  if (statusError) {
    return NextResponse.json({ error: statusError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
