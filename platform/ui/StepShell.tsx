import Link from "next/link";
import { ProgressBar } from "@/platform/ui/ProgressBar";
import { AuroraBackground } from "@/platform/ui/AuroraBackground";
import { Reveal } from "@/platform/ui/Reveal";

/**
 * Single shared wrapper for every onboarding step (identity/goals/nutrition/
 * exercise/review) -- a Tier-3 change here propagates to all of them, unlike
 * auth's 4 separately-styled pages. Onboarding lives inside the main (app)
 * layout (AppHeader + BottomTabBar already render around it), so the aurora
 * is scoped to this component's own content column only -- it deliberately
 * doesn't try to reach the persistent header/tab-bar chrome, which isn't
 * part of the "arrival" moment the way auth's bare isolated page is.
 */
export function StepShell({
  title,
  description,
  currentStep,
  totalSteps,
  backHref,
  skipHref,
  children,
}: {
  title: string;
  description?: string;
  currentStep: number;
  totalSteps: number;
  backHref?: string;
  skipHref?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative isolate overflow-hidden">
      <AuroraBackground size="compact" />
      <Reveal className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-10">
        <ProgressBar current={currentStep} total={totalSteps} />
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          {description ? (
            <p className="mt-1 text-sm text-neutral-500">{description}</p>
          ) : null}
        </div>
        {children}
        <div className="flex items-center justify-between text-sm">
          {backHref ? (
            <Link href={backHref} className="text-neutral-500 hover:underline">
              Back
            </Link>
          ) : (
            <span />
          )}
          {skipHref ? (
            <Link href={skipHref} className="text-neutral-500 hover:underline">
              Skip this step
            </Link>
          ) : null}
        </div>
      </Reveal>
    </div>
  );
}
