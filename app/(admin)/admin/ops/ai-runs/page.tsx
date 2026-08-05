import { listAiRunsAdmin, type AiRunFilter } from "@/domains/ops/service";
import { Card } from "@/platform/ui/Card";
import { EmptyState } from "@/platform/ui/EmptyState";
import { StatusTabs } from "../../StatusTabs";

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "success", label: "Succeeded" },
  { value: "failure", label: "Failed" },
] as const;

function shortId(id: string): string {
  return `${id.slice(0, 8)}…`;
}

export default async function AiRunsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const filter = (status as AiRunFilter) ?? "all";
  const runs = await listAiRunsAdmin(filter, 50);

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Last 50 AI generation attempts across every user (currently just{" "}
        <code className="text-xs">weekly_brief</code> — the only place this app calls a real model
        outside deterministic code, per CLAUDE.md&apos;s AI-only-for-interpretation rule).
      </p>

      <StatusTabs basePath="/admin/ops/ai-runs" options={STATUS_OPTIONS} current={filter} />

      {runs.length === 0 ? (
        <EmptyState title="Nothing here" description="No AI runs match this filter." />
      ) : (
        <div className="space-y-2">
          {runs.map((run) => (
            <Card key={run.id} className={run.success ? "" : "border-red-300 dark:border-red-900"}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium">
                    {run.purpose} · {run.model}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {run.userName ?? shortId(run.userId)} · {new Date(run.createdAt).toLocaleString()}
                  </p>
                  {run.error ? <p className="mt-1 text-sm text-red-600">{run.error}</p> : null}
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs ${
                    run.success
                      ? "border-neutral-300 text-neutral-500 dark:border-neutral-700"
                      : "border-red-300 text-red-600 dark:border-red-900 dark:text-red-400"
                  }`}
                >
                  {run.success ? "success" : "failed"}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
