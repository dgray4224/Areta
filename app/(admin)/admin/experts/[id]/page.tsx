import Link from "next/link";
import { notFound } from "next/navigation";
import { getExpert } from "@/domains/expertregistry/service";
import { requireAdmin } from "@/platform/auth/admin";
import { Card } from "@/platform/ui/Card";
import { ExpertStatusActions } from "./ExpertStatusActions";

export default async function ExpertDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireAdmin();
  const expert = await getExpert(id);
  if (!expert) notFound();

  return (
    <div className="space-y-4">
      <Link href="/admin/experts" className="text-sm text-neutral-500 hover:underline">
        ← Experts
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">{expert.name}</h2>
          <p className="text-sm text-neutral-500">
            {expert.entityType} · slug: {expert.slug}
          </p>
        </div>
        <span className="rounded-full border border-neutral-300 px-2.5 py-0.5 text-xs capitalize text-neutral-500 dark:border-neutral-700">
          {expert.status}
        </span>
      </div>

      <Card className="space-y-3">
        <div>
          <p className="text-xs font-medium text-neutral-500">Roles</p>
          <p className="text-sm">{expert.roles.join(", ") || "—"}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-neutral-500">Specialties</p>
          <p className="text-sm">{expert.specialties.join(", ") || "—"}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-neutral-500">Inclusion reason</p>
          <p className="text-sm">{expert.inclusionReason || "—"}</p>
        </div>
        {expert.reviewedAt ? (
          <div>
            <p className="text-xs font-medium text-neutral-500">Last reviewed</p>
            <p className="text-sm">{new Date(expert.reviewedAt).toLocaleString()}</p>
          </div>
        ) : null}
      </Card>

      <ExpertStatusActions expertId={expert.id} currentStatus={expert.status} reviewerId={user.id} />
    </div>
  );
}
