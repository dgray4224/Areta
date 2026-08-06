import Link from "next/link";
import { listEvidence } from "@/domains/expertregistry/service";
import type { EvidenceBucket, EvidenceKind } from "@/domains/expertregistry/types";
import { Card } from "@/platform/ui/Card";
import { EmptyState } from "@/platform/ui/EmptyState";
import { LinkButton } from "@/platform/ui/Button";
import { StatusTabs } from "../StatusTabs";

const BUCKET_OPTIONS = [
  { value: "all", label: "All" },
  { value: "needs_review", label: "Needs review" },
  { value: "approved", label: "Approved" },
  { value: "other", label: "Other" },
] as const;

const KIND_LABELS: Record<EvidenceKind, string> = {
  expert: "Expert",
  source: "Source",
  claim: "Claim",
  limitation_rule: "Limitation rule",
};

export default async function EvidencePage({
  searchParams,
}: {
  searchParams: Promise<{ bucket?: string }>;
}) {
  const { bucket } = await searchParams;
  const all = await listEvidence();
  const items = bucket && bucket !== "all" ? all.filter((i) => i.bucket === (bucket as EvidenceBucket)) : all;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <StatusTabs basePath="/admin/evidence" options={BUCKET_OPTIONS} current={bucket ?? "all"} />
        <LinkButton href="/admin/evidence/new" variant="secondary">
          + Add evidence
        </LinkButton>
      </div>

      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Experts, sources, claims, and limitation rules together — the evidence base for the goal-first
        training system (migration 0044). Nothing approved here feeds live user plans yet, since the
        recommendation engine that would read it hasn&apos;t been built. Sources have no review step of
        their own (no unreviewed state) — just active/archived.
      </p>

      {items.length === 0 ? (
        <EmptyState title="Nothing here" description="No evidence matches this filter." />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Link key={`${item.kind}-${item.id}`} href={item.href}>
              <Card className="hover:border-brand/40">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-ink">
                        {KIND_LABELS[item.kind]}
                      </span>
                      <p className="truncate font-medium">{item.title}</p>
                    </div>
                    <p className="mt-1 line-clamp-1 text-sm text-neutral-600 dark:text-neutral-400">
                      {item.subtitle}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-neutral-300 px-2.5 py-0.5 text-xs capitalize text-neutral-500 dark:border-neutral-700">
                    {item.status.replace(/_/g, " ")}
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
