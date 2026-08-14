import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";

/**
 * Bearer-authenticated state transitions for one insight — mark it seen,
 * dismiss it, or record that it was shared. Body: `{ "status": "seen" |
 * "dismissed" }` and/or `{ "shared": true }`. Ownership is enforced by
 * RLS (the caller's own token) plus the explicit user_id filter, matching
 * the repo's belt-and-suspenders convention. Timestamps are set
 * server-side; `seen_at` is only written the first time so re-viewing
 * doesn't rewrite history.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ insightId: string }> }) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;
  const { insightId } = await params;

  let body: { status?: unknown; shared?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.status !== undefined && body.status !== "seen" && body.status !== "dismissed") {
    return NextResponse.json({ error: "status must be 'seen' or 'dismissed'" }, { status: 400 });
  }
  if (body.shared !== undefined && body.shared !== true) {
    return NextResponse.json({ error: "shared can only be true" }, { status: 400 });
  }
  if (body.status === undefined && body.shared === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data: existing, error: fetchError } = await supabase
    .from("insights")
    .select("id, seen_at")
    .eq("id", insightId)
    .eq("user_id", userId)
    .maybeSingle();
  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const update: { status?: string; seen_at?: string; shared_at?: string } = {};
  if (body.status === "seen" || body.status === "dismissed") {
    update.status = body.status;
    if (!existing.seen_at) update.seen_at = now;
  }
  if (body.shared === true) {
    update.shared_at = now;
  }

  const { error: updateError } = await supabase.from("insights").update(update).eq("id", insightId).eq("user_id", userId);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
