import Link from "next/link";
import { requireUser } from "@/platform/auth/session";
import { EmptyState } from "@/platform/ui/EmptyState";
import { getGeneratedParameters, generateNutritionParameters } from "@/domains/parameters/service";
import { GenerateParametersButton } from "./GenerateParametersButton";
import { ParametersForm } from "./ParametersForm";

export default async function ParametersPage() {
  const user = await requireUser();
  const parameters = await getGeneratedParameters(user.id, "nutrition");

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <div>
        <Link href="/plan/setup" className="text-sm text-neutral-500 hover:underline">
          ← Back to plan
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Nutrition targets</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          LifeOS calculated these from your onboarding answers. Review the reasoning, edit
          anything that doesn&apos;t look right, and approve before they drive your meal plan.
        </p>
      </div>

      {parameters.length === 0 ? (
        <EmptyState
          title="No targets calculated yet"
          description="LifeOS derives calorie and protein targets from your height, weight, age, and activity level."
          action={
            <GenerateParametersButton userId={user.id} generateAction={generateNutritionParameters} />
          }
        />
      ) : (
        <>
          <GenerateParametersButton
            userId={user.id}
            generateAction={generateNutritionParameters}
            label="Recalculate from latest onboarding answers"
          />
          <ParametersForm
            userId={user.id}
            domain="nutrition"
            parameters={parameters}
            redirectTo="/plan"
          />
        </>
      )}
    </div>
  );
}
