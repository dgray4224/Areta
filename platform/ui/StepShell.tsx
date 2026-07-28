import Link from "next/link";
import { ProgressBar } from "@/platform/ui/ProgressBar";

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
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-10">
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
    </div>
  );
}
