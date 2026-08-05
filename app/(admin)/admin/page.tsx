import Link from "next/link";
import { getAdminDashboardCounts } from "@/domains/expertregistry/service";
import { countExercisesByStatus } from "@/domains/exerciselibrary/service";
import { countRecipesByStatus } from "@/domains/recipes/service";
import { Card } from "@/platform/ui/Card";

export default async function AdminDashboardPage() {
  const [counts, exercisesInReview, recipesInReview] = await Promise.all([
    getAdminDashboardCounts(),
    countExercisesByStatus("review"),
    countRecipesByStatus("review"),
  ]);

  const tiles = [
    {
      href: "/admin/experts?status=candidate",
      label: "Candidate experts awaiting review",
      value: counts.candidateExperts,
    },
    {
      href: "/admin/claims?status=unreviewed",
      label: "Unreviewed claims",
      value: counts.unreviewedClaims,
    },
    {
      href: "/admin/limitation-rules?status=unreviewed",
      label: "Unreviewed limitation rules",
      value: counts.unreviewedLimitationRules,
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

  return (
    <div className="space-y-6">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Experts/sources/claims/limitation rules are a content-review queue for the goal-first training
        system (migration 0044) — nothing approved there feeds live user plans yet, since the
        recommendation engine that would read it hasn&apos;t been built (see README &quot;Known
        gaps&quot;). Exercises and recipes are different: <span className="font-medium">active</span>{" "}
        rows in both already feed real workout and meal-plan generation, which is exactly why new ones
        default to <span className="font-medium">review</span> instead of going live immediately.
        Ops/user-management sections aren&apos;t built yet.
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
    </div>
  );
}
