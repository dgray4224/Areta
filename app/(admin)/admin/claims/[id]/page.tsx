import Link from "next/link";
import { notFound } from "next/navigation";
import { getExpertClaim } from "@/domains/expertregistry/service";
import { requireAdmin } from "@/platform/auth/admin";
import { Card } from "@/platform/ui/Card";
import { ClaimReviewActions } from "./ClaimReviewActions";

export default async function ClaimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin();
  const claim = await getExpertClaim(id);
  if (!claim) notFound();

  return (
    <div className="space-y-4">
      <Link href="/admin/evidence" className="text-sm text-neutral-500 hover:underline">
        ← Evidence
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">{claim.topic}</h2>
          <p className="text-sm text-neutral-500">
            {claim.expertName} · {claim.claimType.replace(/_/g, " ")}
          </p>
        </div>
        <span className="rounded-full border border-neutral-300 px-2.5 py-0.5 text-xs capitalize text-neutral-500 dark:border-neutral-700">
          {claim.reviewStatus}
        </span>
      </div>

      <Card className="space-y-3">
        <div>
          <p className="text-xs font-medium text-neutral-500">Normalized claim</p>
          <p className="text-sm">{claim.normalizedClaim}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-neutral-500">Rationale</p>
          <p className="text-sm">{claim.shortRationale}</p>
        </div>
        {claim.verbatimExcerpt ? (
          <div>
            <p className="text-xs font-medium text-neutral-500">Verbatim excerpt</p>
            <p className="text-sm italic">&ldquo;{claim.verbatimExcerpt}&rdquo;</p>
          </div>
        ) : null}
        <div>
          <p className="text-xs font-medium text-neutral-500">Source</p>
          <p className="text-sm">
            {claim.sourceUrl ? (
              <a href={claim.sourceUrl} target="_blank" rel="noreferrer" className="hover:underline">
                {claim.sourceTitle}
              </a>
            ) : (
              claim.sourceTitle
            )}
            {claim.timestampSeconds != null ? ` · t=${claim.timestampSeconds}s` : ""}
            {claim.pageNumber != null ? ` · p.${claim.pageNumber}` : ""}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-medium text-neutral-500">Applicable goals</p>
            <p>{claim.applicableGoals.join(", ") || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500">Applicable levels</p>
            <p>{claim.applicableLevels.join(", ") || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500">Required equipment</p>
            <p>{claim.requiredEquipment.join(", ") || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500">Excluded conditions</p>
            <p>{claim.excludedConditions.join(", ") || "—"}</p>
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-neutral-500">Confidence</p>
          <p className="text-sm capitalize">{claim.confidence}</p>
        </div>
      </Card>

      <ClaimReviewActions claimId={claim.id} currentStatus={claim.reviewStatus} />
    </div>
  );
}
