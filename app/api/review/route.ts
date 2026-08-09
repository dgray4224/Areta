import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { getOrCreateWeeklyReview, getRecommendationsForCurrentReview, getReviewFactsBundle } from "@/domains/review/service";

/**
 * Bearer-authenticated bundle for the mobile Review tab — everything the
 * AI Summary/Plan Recap/Vitals/Streaks/Check-in sub-tabs need in one round
 * trip, so switching between them doesn't each fire a separate request.
 * Deliberately read-only: `getReviewFactsBundle` recomputes the
 * deterministic facts fresh (cheap — pure queries/math, no AI call), so
 * this works whether or not a brief has been generated yet this week.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  const [review, recommendations, facts] = await Promise.all([
    getOrCreateWeeklyReview(userId, supabase),
    getRecommendationsForCurrentReview(userId, supabase),
    getReviewFactsBundle(userId, supabase),
  ]);

  return NextResponse.json({
    weekStart: review.weekStart,
    status: review.status,
    metrics: review.metrics,
    brief: review.brief,
    answers: review.answers,
    recommendations,
    previousWeekMetrics: facts.weeklyMetricsHistory[0]?.metrics ?? null,
    achievements: facts.achievements,
    goalTrajectories: facts.goalTrajectories,
    streaks: facts.streaks,
    correlationFindings: facts.correlationFindings,
    experimentOutcomes: facts.experimentOutcomes,
  });
}
