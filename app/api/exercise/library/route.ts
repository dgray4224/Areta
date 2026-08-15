import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearerRequest } from "@/platform/auth/bearer";
import { getAllExercises } from "@/domains/exerciselibrary/service";

/**
 * Bearer-authenticated read of the full exercise library (mobile Exercise
 * tab's "change exercise" picker -- browse by muscle group, not just the
 * up-to-2 curated alternates GET /api/exercise already returns). Small
 * enough (currently ~160 rows, comfortably under a few hundred) to
 * return in full and let the client group/filter locally rather than
 * building server-side search/pagination for it. Deliberately does NOT
 * equipment-filter -- an explicit product
 * decision (unlike the curated-alternates path, which does) so a user
 * browsing by muscle group sees everything, not a pre-narrowed set.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateBearerRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Missing or invalid bearer token" }, { status: 401 });
  }
  const { supabase } = auth;

  const exercises = await getAllExercises(supabase);

  return NextResponse.json({
    exercises: exercises.map((e) => ({
      id: e.id,
      name: e.name,
      movementPattern: e.movementPattern,
      // Normalized taxonomy + modality (content-expansion 4d, 2026-08-14)
      // so the mobile picker can group/filter by movement and by
      // equipment style, not just primaryMuscleGroups[0]. Found missing
      // here via /code-review -- the mobile picker's "Movement" axis was
      // reading undefined and crashing.
      movementPatterns: e.movementPatterns,
      modality: e.modality,
      equipmentRequired: e.equipmentRequired,
      primaryMuscleGroups: e.primaryMuscleGroups,
      instructions: e.instructions,
    })),
  });
}
