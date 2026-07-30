import Link from "next/link";
import { requireUser } from "@/platform/auth/session";
import { EmptyState } from "@/platform/ui/EmptyState";
import { getPrepPlanForWeek } from "@/domains/prep/service";
import { GeneratePrepPlanButton } from "./GeneratePrepPlanButton";

export default async function PrepPage() {
  const user = await requireUser();
  const plan = await getPrepPlanForWeek(user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <Link href="/plan/setup" className="text-sm text-neutral-500 hover:underline">
        ← Back to plan
      </Link>
      <h1 className="text-2xl font-semibold">Sunday prep plan</h1>

      {!plan || plan.steps.length === 0 ? (
        <EmptyState
          title="No prep plan yet"
          description="Approve a meal plan first — the prep plan is built from that week's recipes."
          action={<GeneratePrepPlanButton userId={user.id} />}
        />
      ) : (
        <>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            ~{plan.estimatedMinutes} minutes · {plan.containerCount} containers
          </p>
          <ol className="space-y-2">
            {plan.steps.map((step) => (
              <li
                key={step.id}
                className="flex gap-3 rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800"
              >
                <span className="font-medium text-neutral-400">{step.stepNumber}.</span>
                <span>{step.instruction}</span>
              </li>
            ))}
          </ol>
          <GeneratePrepPlanButton userId={user.id} />
        </>
      )}
    </div>
  );
}
