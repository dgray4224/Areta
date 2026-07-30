import Link from "next/link";
import { requireUser } from "@/platform/auth/session";
import { EmptyState } from "@/platform/ui/EmptyState";
import { getGeneratedParameters, generateExerciseParameters } from "@/domains/parameters/service";
import { GenerateParametersButton } from "../parameters/GenerateParametersButton";
import { ParametersForm } from "../parameters/ParametersForm";

export default async function ExerciseParametersPage() {
  const user = await requireUser();
  const parameters = await getGeneratedParameters(user.id, "exercise");

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <div>
        <Link href="/plan/setup" className="text-sm text-neutral-500 hover:underline">
          ← Back to plan
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Training parameters</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          LifeOS calculated these from your Exercise onboarding answers. Review the reasoning, edit
          anything that doesn&apos;t look right, and approve before they drive your workout plan.
        </p>
      </div>

      {parameters.length === 0 ? (
        <EmptyState
          title="No training parameters calculated yet"
          description="LifeOS derives sessions/week, phase structure, and progression from your archetype and availability."
          action={
            <GenerateParametersButton
              userId={user.id}
              generateAction={generateExerciseParameters}
              label="Calculate my training parameters"
            />
          }
        />
      ) : (
        <>
          <GenerateParametersButton
            userId={user.id}
            generateAction={generateExerciseParameters}
            label="Recalculate from latest onboarding answers"
          />
          <ParametersForm
            userId={user.id}
            domain="exercise"
            parameters={parameters}
            redirectTo="/plan"
          />
        </>
      )}
    </div>
  );
}
