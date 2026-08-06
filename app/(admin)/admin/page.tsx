import Link from "next/link";
import { requireAdmin } from "@/platform/auth/admin";
import { getAdminDashboardCounts } from "@/domains/expertregistry/service";
import { countExercisesByStatus } from "@/domains/exerciselibrary/service";
import { countRecipesByStatus } from "@/domains/recipes/service";
import { countStaleWorkoutPlans, countAiRunFailures } from "@/domains/ops/service";
import { Card } from "@/platform/ui/Card";

export default async function AdminDashboardPage() {
  // requireAdmin() here is a cheap repeat of the layout's own check —
  // needed because Next.js layouts can't pass props to page components,
  // and this page needs adminRole to decide whether to show ops tiles at
  // all (same pattern as app/(app)/settings/layout.tsx independently
  // fetching admin status for its own nav).
  const { adminRole } = await requireAdmin();

  const [counts, exercisesInReview, recipesInReview, staleWorkoutPlans, aiFailures7d] = await Promise.all([
    getAdminDashboardCounts(),
    countExercisesByStatus("review"),
    countRecipesByStatus("review"),
    adminRole === "owner" ? countStaleWorkoutPlans() : Promise.resolve(null),
    adminRole === "owner" ? countAiRunFailures(7) : Promise.resolve(null),
  ]);

  const tiles = [
    {
      href: "/admin/evidence?bucket=needs_review",
      label: "Evidence awaiting review",
      value: counts.candidateExperts + counts.unreviewedClaims + counts.unreviewedLimitationRules,
    },
    {
      href: "/admin/content/exercises?status=review",
      label: "Exercises in review",
      value: exercisesInReview,
    },
    {
      href: "/admin/content/recipes?status=review",
      label: "Recipes in review",
      value: recipesInReview,
    },
  ];

  const opsTiles =
    adminRole === "owner"
      ? [
          {
            href: "/admin/ops/cron",
            label: "Active workout plans currently stale",
            value: staleWorkoutPlans ?? 0,
          },
          {
            href: "/admin/ops/ai-runs?status=failure",
            label: "AI run failures (7 days)",
            value: aiFailures7d ?? 0,
          },
        ]
      : [];

  return (
    <div className="space-y-6">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Evidence (experts/sources/claims/limitation rules) is a content-review queue for the goal-first
        training system (migration 0044) — nothing approved there feeds live user plans yet, since the
        recommendation engine that would read it hasn&apos;t been built (see README &quot;Known
        gaps&quot;). Exercises and recipes are different: <span className="font-medium">active</span>{" "}
        rows in both already feed real workout and meal-plan generation, which is exactly why new ones
        default to <span className="font-medium">review</span> instead of going live immediately.
        {adminRole === "owner" ? " Ops and Users below are owner-only." : null}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile) => (
          <Link key={tile.href} href={tile.href}>
            <Card className="h-full transition-colors hover:border-brand/40">
              <p className="text-3xl font-semibold">{tile.value}</p>
              <p className="mt-1 text-sm text-neutral-500">{tile.label}</p>
            </Card>
          </Link>
        ))}
      </div>

      {opsTiles.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">Ops</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {opsTiles.map((tile) => (
              <Link key={tile.href} href={tile.href}>
                <Card className="h-full transition-colors hover:border-brand/40">
                  <p className="text-3xl font-semibold">{tile.value}</p>
                  <p className="mt-1 text-sm text-neutral-500">{tile.label}</p>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
