import Link from "next/link";
import { notFound } from "next/navigation";
import { getClientHistorySummary } from "@/domains/trainer/service";
import { Card } from "@/platform/ui/Card";
import { EmptyState } from "@/platform/ui/EmptyState";
import { LinkButton } from "@/platform/ui/Button";
import { GoalEditor } from "./GoalEditor";
import { RemoveClientSection } from "./RemoveClientSection";

export default async function ClientDetailPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const result = await getClientHistorySummary(clientId);
  if (!result.ok) notFound();
  const { clientName, recentWeightLogs, recentSleepLogs, recentNutritionLogs, recentRecoveryLogs, goals } =
    result.data;

  return (
    <div className="space-y-6">
      <Link href="/trainer" className="text-sm text-neutral-500 hover:underline">
        ← Dashboard
      </Link>
      <h1 className="text-2xl font-semibold">{clientName ?? "Your client"}</h1>

      <div className="flex flex-wrap gap-2">
        <LinkButton href={`/trainer/clients/${clientId}/nutrition`} variant="secondary">
          Nutrition
        </LinkButton>
        <LinkButton href={`/trainer/clients/${clientId}/workout`} variant="secondary">
          Workout program
        </LinkButton>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Goals</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Only fitness goals — nutrition, exercise, recovery. You can edit status and priority here.
        </p>
        {goals.length === 0 ? (
          <EmptyState
            title="No active fitness goals"
            description="Nothing in nutrition, exercise, or recovery is currently active for this client."
          />
        ) : (
          <div className="space-y-2">
            {goals.map((goal) => (
              <GoalEditor key={goal.id} goal={goal} clientId={clientId} />
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="mb-2 text-sm font-medium">Recent weight</p>
          {recentWeightLogs.length === 0 ? (
            <p className="text-xs text-neutral-500">No entries logged.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {recentWeightLogs.map((log) => (
                <li key={log.id} className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>{new Date(log.loggedAt).toLocaleDateString()}</span>
                  <span>
                    {log.weight} {log.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <p className="mb-2 text-sm font-medium">Recent sleep</p>
          {recentSleepLogs.length === 0 ? (
            <p className="text-xs text-neutral-500">No entries logged.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {recentSleepLogs.map((log) => (
                <li key={log.id} className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>{log.date}</span>
                  <span>
                    {log.totalDurationMinutes ? `${Math.round(log.totalDurationMinutes / 60)}h` : "—"}
                    {log.quality ? ` · quality ${log.quality}/5` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <p className="mb-2 text-sm font-medium">Recent nutrition</p>
          {recentNutritionLogs.length === 0 ? (
            <p className="text-xs text-neutral-500">No entries logged.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {recentNutritionLogs.map((log) => (
                <li key={log.id} className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>
                    {log.date} · {log.meal}
                  </span>
                  <span>{log.calories != null ? `${log.calories} cal` : log.food}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <p className="mb-2 text-sm font-medium">Recent recovery</p>
          {recentRecoveryLogs.length === 0 ? (
            <p className="text-xs text-neutral-500">No entries logged.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {recentRecoveryLogs.map((log) => (
                <li key={log.id} className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>{log.date}</span>
                  <span>
                    {log.pain != null ? `pain ${log.pain}/10` : ""}
                    {log.energy != null ? ` · energy ${log.energy}/5` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <RemoveClientSection clientId={clientId} />
    </div>
  );
}
