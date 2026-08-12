import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { getEnergyBalanceTrend } from "@/domains/review/energy-balance";

const DEFAULT_DAYS = 14;
const MAX_DAYS = 90;

/**
 * Bearer-authenticated energy-balance-trend read for the mobile Review
 * tab's calorie tracker -- mirrors app/api/review/vitals/route.ts's
 * pattern exactly (same auth, same `?days=` param/clamp), just backed by
 * getEnergyBalanceTrend instead of getVitalsTrend.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase, userId } = auth;

  const params = request.nextUrl.searchParams;
  const days = Math.min(MAX_DAYS, Math.max(1, Number(params.get("days")) || DEFAULT_DAYS));

  const result = await getEnergyBalanceTrend(userId, days, supabase);
  return NextResponse.json(result);
}
