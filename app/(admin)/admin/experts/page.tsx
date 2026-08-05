import Link from "next/link";
import { listExperts } from "@/domains/expertregistry/service";
import type { ExpertStatus } from "@/domains/expertregistry/types";
import { Card } from "@/platform/ui/Card";
import { EmptyState } from "@/platform/ui/EmptyState";
import { LinkButton } from "@/platform/ui/Button";
import { StatusTabs } from "../StatusTabs";

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "candidate", label: "Candidate" },
  { value: "approved", label: "Approved" },
  { value: "inactive", label: "Inactive" },
  { value: "excluded", label: "Excluded" },
] as const;

export default async function ExpertsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const experts = await listExperts(
    status && status !== "all" ? (status as ExpertStatus) : undefined
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <StatusTabs basePath="/admin/experts" options={STATUS_OPTIONS} current={status} />
        <LinkButton href="/admin/experts/new" variant="secondary">
          + New expert
        </LinkButton>
      </div>

      {experts.length === 0 ? (
        <EmptyState
          title="No experts here"
          description="Add a trainer, institution, or governing body to start building the evidence registry."
        />
      ) : (
        <div className="space-y-2">
          {experts.map((expert) => (
            <Link key={expert.id} href={`/admin/experts/${expert.id}`}>
              <Card className="flex items-center justify-between hover:border-brand/40">
                <div>
                  <p className="font-medium">{expert.name}</p>
                  <p className="text-xs text-neutral-500">
                    {expert.entityType} · {expert.specialties.join(", ") || "no specialties tagged"}
                  </p>
                </div>
                <span className="rounded-full border border-neutral-300 px-2.5 py-0.5 text-xs capitalize text-neutral-500 dark:border-neutral-700">
                  {expert.status}
                </span>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
