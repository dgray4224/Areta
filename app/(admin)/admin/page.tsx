import Link from "next/link";
import { getAdminDashboardCounts } from "@/domains/expertregistry/service";
import { Card } from "@/platform/ui/Card";

export default async function AdminDashboardPage() {
  const counts = await getAdminDashboardCounts();

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
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Content review queue for the goal-first training system (migration 0044). Nothing approved
        here feeds live user plans yet — the recommendation engine that will read this evidence base
        hasn&apos;t been built (see README &quot;Known gaps&quot;). Content management (exercise/recipe
        editing) and ops/user-management sections aren&apos;t built yet either.
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
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
