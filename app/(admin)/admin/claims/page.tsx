import Link from "next/link";
import { listExpertClaims } from "@/domains/expertregistry/service";
import type { ReviewStatus } from "@/domains/expertregistry/types";
import { Card } from "@/platform/ui/Card";
import { EmptyState } from "@/platform/ui/EmptyState";
import { LinkButton } from "@/platform/ui/Button";
import { StatusTabs } from "../StatusTabs";

const STATUS_OPTIONS = [
  { value: "unreviewed", label: "Unreviewed" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
] as const;

export default async function ClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const effectiveStatus = status ?? "unreviewed";
  const claims = await listExpertClaims(
    effectiveStatus !== "all" ? (effectiveStatus as ReviewStatus) : undefined
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <StatusTabs basePath="/admin/claims" options={STATUS_OPTIONS} current={effectiveStatus} />
        <LinkButton href="/admin/claims/new" variant="secondary">
          + New claim
        </LinkButton>
      </div>

      {claims.length === 0 ? (
        <EmptyState
          title="Queue is empty"
          description="No claims match this filter."
        />
      ) : (
        <div className="space-y-2">
          {claims.map((claim) => (
            <Link key={claim.id} href={`/admin/claims/${claim.id}`}>
              <Card className="hover:border-brand/40">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium">{claim.topic}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-400">
                      {claim.normalizedClaim}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {claim.expertName} · {claim.claimType.replace(/_/g, " ")} · confidence:{" "}
                      {claim.confidence}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-neutral-300 px-2.5 py-0.5 text-xs capitalize text-neutral-500 dark:border-neutral-700">
                    {claim.reviewStatus}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
