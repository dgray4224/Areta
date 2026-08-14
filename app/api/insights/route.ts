import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";

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
  return NextResponse.json({ insights: data ?? [] });
}
