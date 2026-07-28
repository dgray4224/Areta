"use client";

import { ErrorState } from "@/platform/ui/ErrorState";

export default function OnboardingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <ErrorState
        title="Something went wrong during onboarding"
        description={error.message || "An unexpected error occurred. Your progress up to the last saved step is kept."}
        onRetry={reset}
      />
    </div>
  );
}
