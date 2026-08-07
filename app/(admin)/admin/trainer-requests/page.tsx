import { listPendingTrainerRoleRequests } from "@/domains/users/service";
import { Card } from "@/platform/ui/Card";
import { EmptyState } from "@/platform/ui/EmptyState";
import { TrainerRoleRequestActions } from "./TrainerRoleRequestActions";

export default async function TrainerRoleRequestsPage() {
  const requests = await listPendingTrainerRoleRequests();

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {requests.length} pending {requests.length === 1 ? "request" : "requests"} to become a trainer.
        Approving grants profiles.is_trainer through the same setUserTrainerStatus() path as
        Users → Trainer status — nothing here duplicates that logic.
      </p>

      {requests.length === 0 ? (
        <EmptyState title="No pending requests" description="Nothing to review right now." />
      ) : (
        <div className="space-y-2">
          {requests.map((r) => (
            <Card key={r.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{r.fullName || r.email || "Unknown user"}</p>
                  {r.fullName && r.email ? <p className="text-xs text-neutral-500">{r.email}</p> : null}
                </div>
                <span className="text-xs text-neutral-500">{new Date(r.createdAt).toLocaleDateString()}</span>
              </div>
              {r.message ? <p className="text-sm text-neutral-600 dark:text-neutral-400">{r.message}</p> : null}
              <TrainerRoleRequestActions requestId={r.id} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
