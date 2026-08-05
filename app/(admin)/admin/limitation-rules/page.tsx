import Link from "next/link";
import { listLimitationRules } from "@/domains/expertregistry/service";
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

export default async function LimitationRulesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const effectiveStatus = status ?? "unreviewed";
  const rules = await listLimitationRules(
    effectiveStatus !== "all" ? (effectiveStatus as ReviewStatus) : undefined
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <StatusTabs basePath="/admin/limitation-rules" options={STATUS_OPTIONS} current={effectiveStatus} />
        <LinkButton href="/admin/limitation-rules/new" variant="secondary">
          + New rule
        </LinkButton>
      </div>

      <p className="text-xs text-neutral-500">
        <span className="font-medium">exclude</span> rows are a hard filter the recommendation engine
        will apply before scoring ever runs — never a scoring penalty. Review these carefully.
      </p>

      {rules.length === 0 ? (
        <EmptyState title="Queue is empty" description="No limitation rules match this filter." />
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <Link key={rule.id} href={`/admin/limitation-rules/${rule.id}`}>
              <Card className="hover:border-brand/40">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {rule.limitationTag} → {rule.action}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-400">
                      {rule.rationale}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {rule.exerciseName ?? rule.movementPattern ?? "—"}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-neutral-300 px-2.5 py-0.5 text-xs capitalize text-neutral-500 dark:border-neutral-700">
                    {rule.status}
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
