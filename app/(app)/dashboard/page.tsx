import { redirect } from "next/navigation";
import { requireUser } from "@/platform/auth/session";
import { EmptyState } from "@/platform/ui/EmptyState";
import { getDashboardData } from "./data";

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await getDashboardData(user.id);

  if (!data.profile.onboardingCompletedAt) {
    redirect("/onboarding");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-10">
      <div>
        <p className="text-sm text-neutral-500">Welcome back</p>
        <h1 className="text-2xl font-semibold">{data.profile.fullName ?? "there"}</h1>
      </div>

      {data.currentPhase ? (
        <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-sm font-medium text-neutral-500">Current phase</p>
          <p className="text-lg font-medium">{data.currentPhase.name}</p>
          {data.currentPhase.mission ? (
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {data.currentPhase.mission}
            </p>
          ) : null}
        </div>
      ) : (
        <EmptyState
          title="No active phase yet"
          description="Complete onboarding to generate your first phase."
        />
      )}

      <section>
        <h2 className="text-sm font-medium text-neutral-500">Active domains</h2>
        {data.domains.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {data.domains.map((d) => (
              <span
                key={d.key}
                className="rounded-full bg-neutral-200 px-3 py-1 text-xs dark:bg-neutral-800"
              >
                {d.label}
              </span>
            ))}
          </div>
        ) : (
          <EmptyState title="No active domains" />
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-500">Ranked goals</h2>
        {data.goals.length > 0 ? (
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
            {data.goals.map((g) => (
              <li key={g.id}>
                {g.outcome}
                {g.targetDate ? ` — by ${g.targetDate}` : ""}
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState title="No goals yet" />
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium text-neutral-500">This week&apos;s outcomes</h2>
        {data.weeklyOutcomes.length > 0 ? (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {data.weeklyOutcomes.map((w, i) => (
              <li key={i}>{w.outcomeText}</li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No weekly outcomes yet" />
        )}
      </section>

      <section className="rounded-lg border border-dashed border-neutral-300 p-4 text-sm text-neutral-500 dark:border-neutral-700">
        Daily logging, weekly review, and AI-generated plans arrive in later phases. For now, this
        is your personalized starting point.
      </section>
    </div>
  );
}
