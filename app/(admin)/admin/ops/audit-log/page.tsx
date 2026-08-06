import { listAdminActionsAdmin } from "@/domains/ops/service";
import { Card } from "@/platform/ui/Card";
import { EmptyState } from "@/platform/ui/EmptyState";

const ACTION_LABELS: Record<string, string> = {
  user_role_changed: "Role changed",
  user_trainer_status_changed: "Trainer status changed",
  user_deleted: "Account deleted",
  expert_status_changed: "Expert status changed",
  expert_claim_reviewed: "Claim reviewed",
  limitation_rule_reviewed: "Limitation rule reviewed",
  exercise_status_changed: "Exercise status changed",
  recipe_status_changed: "Recipe status changed",
  source_status_changed: "Source status changed",
  evidence_bundle_created: "Evidence bundle created",
  trainer_invite_redeemed: "Trainer invite redeemed",
  trainer_relationship_ended: "Trainer relationship ended",
  client_goal_updated: "Client goal updated",
  client_nutrition_parameters_approved: "Client nutrition targets approved",
  client_meal_plan_generated: "Client meal plan generated",
  client_meal_plan_approved: "Client meal plan approved",
  client_workout_plan_generated: "Client workout plan generated",
  client_workout_plan_approved: "Client workout plan approved",
  client_workout_item_customized: "Client workout item customized",
  client_workout_item_added: "Client workout item added",
  trainer_invite_code_generated: "Trainer invite code generated",
  trainer_invite_code_revoked: "Trainer invite code revoked",
  trainer_request_accepted: "Trainer request accepted",
};

function shortId(id: string): string {
  return `${id.slice(0, 8)}…`;
}

export default async function AuditLogPage() {
  const actions = await listAdminActionsAdmin(100);

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Last {actions.length} admin actions: role changes, account deletions, and content-review
        decisions. Append-only — nothing here can be edited or deleted, including by an owner.
      </p>

      {actions.length === 0 ? (
        <EmptyState title="Nothing here yet" description="Admin actions will show up here as they happen." />
      ) : (
        <div className="space-y-2">
          {actions.map((entry) => (
            <Card key={entry.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium">{ACTION_LABELS[entry.action] ?? entry.action}</p>
                  <p className="text-xs text-neutral-500">
                    {entry.actorEmail ?? (entry.actorId ? shortId(entry.actorId) : "unknown actor")} ·{" "}
                    {entry.targetType} {entry.targetId ? shortId(entry.targetId) : ""} ·{" "}
                    {new Date(entry.createdAt).toLocaleString()}
                  </p>
                  {entry.detail ? (
                    <p className="mt-1 truncate text-xs text-neutral-500" title={JSON.stringify(entry.detail)}>
                      {JSON.stringify(entry.detail)}
                    </p>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
