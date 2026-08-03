import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import {
  createTimelineEvent,
  deleteTimelineEvent,
  getTimelineEventsForDate,
  setTimelineEventScheduledTime,
  setTimelineEventCompleted,
  setTimelineEventNotes,
} from "@/domains/timeline/service";

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Bearer-token-authenticated endpoint for the mobile "At a Glance" tray's
 * ad-hoc timeline items (common-task quick-adds + custom titles -- see
 * domains/timeline/service.ts). GET lists today's (or ?date=) events,
 * POST creates one, PATCH sets its scheduled time / completed / notes,
 * DELETE removes one.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  const date = request.nextUrl.searchParams.get("date") || todayDateString();
  const events = await getTimelineEventsForDate(userId, date, supabase);
  return NextResponse.json({ events });
}

export async function POST(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = await createTimelineEvent(userId, body, supabase);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ event: result.data });
}

export async function PATCH(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  let body: { itemId?: unknown; scheduledTime?: unknown; endTime?: unknown; completed?: unknown; notes?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.itemId !== "string") {
    return NextResponse.json({ error: "itemId (string) is required" }, { status: 400 });
  }
  const hasScheduledTime = typeof body.scheduledTime === "string" || body.scheduledTime === null;
  const hasEndTime = typeof body.endTime === "string" || body.endTime === null;
  const hasCompleted = typeof body.completed === "boolean";
  const hasNotes = typeof body.notes === "string" || body.notes === null;
  if (!hasScheduledTime && !hasCompleted && !hasNotes) {
    return NextResponse.json(
      {
        error:
          "at least one of scheduledTime (string | null), completed (boolean), or notes (string | null) is required",
      },
      { status: 400 }
    );
  }

  if (hasScheduledTime) {
    // endTime is only honored alongside scheduledTime -- an explicit
    // window from the edit sheet's start+end pickers. Omitted entirely,
    // it falls back to the auto-preserve-shift used by dragging.
    const result = await setTimelineEventScheduledTime(
      userId,
      body.itemId,
      body.scheduledTime as string | null,
      supabase,
      hasEndTime ? (body.endTime as string | null) : undefined
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
  }
  if (hasCompleted) {
    const result = await setTimelineEventCompleted(userId, body.itemId, body.completed as boolean, supabase);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
  }
  if (hasNotes) {
    const result = await setTimelineEventNotes(userId, body.itemId, body.notes as string | null, supabase);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  const itemId = request.nextUrl.searchParams.get("itemId");
  if (!itemId) {
    return NextResponse.json({ error: "itemId query param is required" }, { status: 400 });
  }

  const result = await deleteTimelineEvent(userId, itemId, supabase);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
