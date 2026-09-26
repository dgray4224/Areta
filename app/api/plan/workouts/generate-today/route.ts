import { NextResponse, type NextRequest } from "next/server";

import { todayForUser } from "@/domains/activity-summary/service";
import { applyTodayWorkoutSession } from "@/domains/workoutplan/customize";
import { TODAY_FOCUSES, type TodayFocus } from "@/domains/workoutplan/generate-today";
import { getTodayWorkoutOptions } from "@/domains/workoutplan/today-service";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { weekStartFor } from "@/platform/ui/week-dates";

/**
 * "Generate a workout today."
 *
 * Two calls, one route, because they are two halves of one decision:
 *
 *   POST { focus }                -> three options, nothing written
 *   POST { focus, optionKey }     -> writes the chosen one to that day
 *
 * The client echoes back a focus and an option key, never the exercises
 * themselves. Letting a client post a list of exercise ids to save would
 * hand it a way around the injury filter and the beginner guard, so the
 * server regenerates from the same inputs and saves the option it
 * produced. generateTodayWorkouts is deterministic for a given user and
 * focus, so the option the user tapped is the option that gets written.
 */

function isFocus(value: unknown): value is TodayFocus {
  return typeof value === "string" && (TODAY_FOCUSES as readonly string[]).includes(value);
}

function dayOfWeekFor(dateString: string): number {
  return new Date(`${dateString}T00:00:00Z`).getUTCDay();
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
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const { focus, optionKey, date: requestedDate } = (body ?? {}) as {
    focus?: unknown;
    optionKey?: unknown;
    date?: unknown;
  };

  if (!isFocus(focus)) {
    return NextResponse.json(
      { error: `Pick one of: ${TODAY_FOCUSES.join(", ")}.` },
      { status: 400 }
    );
  }

  const generated = await getTodayWorkoutOptions(userId, focus, supabase);
  if (!generated.ok) {
    return NextResponse.json({ error: generated.error }, { status: 500 });
  }

  // Preview: show the user what they'd be committing to.
  if (optionKey === undefined || optionKey === null) {
    return NextResponse.json({
      focus,
      options: generated.data.options,
      warnings: generated.data.warnings,
    });
  }

  if (typeof optionKey !== "string") {
    return NextResponse.json({ error: "optionKey must be a string." }, { status: 400 });
  }

  const option = generated.data.options.find((o) => o.key === optionKey);
  if (!option) {
    // Almost always a stale screen -- the library or the user's recent
    // history moved between the two calls. Hand back the current three
    // rather than a bare error, so the client can re-render instead of
    // dead-ending.
    return NextResponse.json(
      {
        error: "That workout is no longer one of the options.",
        focus,
        options: generated.data.options,
      },
      { status: 409 }
    );
  }

  const date =
    typeof requestedDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
      ? requestedDate
      : await todayForUser(supabase, userId);

  const applied = await applyTodayWorkoutSession(
    userId,
    weekStartFor(date),
    dayOfWeekFor(date),
    option.exercises.map((ex) => ({
      exerciseId: ex.exerciseId,
      sets: ex.sets,
      reps: ex.reps,
      durationMinutes: ex.durationMinutes,
      // Rest isn't a column on workout_plan_items, so the prescription
      // would otherwise be lost -- same place prescribe.ts puts it.
      coachingNotes: ex.restSeconds ? `Rest ~${ex.restSeconds}s between sets.` : null,
    })),
    supabase
  );

  if (!applied.ok) {
    return NextResponse.json({ error: applied.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    focus,
    date,
    applied: option,
    displaced: applied.data.displaced,
    warnings: [...generated.data.warnings, ...option.warnings, ...applied.data.warnings],
  });
}
