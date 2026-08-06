import Link from "next/link";
import { notFound } from "next/navigation";
import { getLimitationRule } from "@/domains/expertregistry/service";
import { requireAdmin } from "@/platform/auth/admin";
import { Card } from "@/platform/ui/Card";
import { LimitationRuleReviewActions } from "./LimitationRuleReviewActions";

export default async function LimitationRuleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdmin();
  const rule = await getLimitationRule(id);
  if (!rule) notFound();

  return (
    <div className="space-y-4">
      <Link href="/admin/evidence" className="text-sm text-neutral-500 hover:underline">
        ← Evidence
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            {rule.limitationTag} → {rule.action}
          </h2>
        </div>
        <span className="rounded-full border border-neutral-300 px-2.5 py-0.5 text-xs capitalize text-neutral-500 dark:border-neutral-700">
          {rule.status}
        </span>
      </div>

      <Card className="space-y-3">
        <div>
          <p className="text-xs font-medium text-neutral-500">Rationale</p>
          <p className="text-sm">{rule.rationale}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-neutral-500">Target</p>
          <p className="text-sm">{rule.exerciseName ?? rule.movementPattern ?? "—"}</p>
        </div>
        {rule.action === "substitute" ? (
          <div>
            <p className="text-xs font-medium text-neutral-500">Substitute movement pattern</p>
            <p className="text-sm">{rule.substituteMovementPattern ?? "—"}</p>
          </div>
        ) : null}
        <div>
          <p className="text-xs font-medium text-neutral-500">Source</p>
          <p className="text-sm">{rule.sourceTitle ?? "—"}</p>
        </div>
      </Card>

      <LimitationRuleReviewActions ruleId={rule.id} currentStatus={rule.status} />
    </div>
  );
}
