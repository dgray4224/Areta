"use client";

import { ErrorState } from "@/platform/ui/ErrorState";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <ErrorState
        title="Couldn't load your dashboard"
        description={error.message || "An unexpected error occurred."}
        onRetry={reset}
      />
    </div>
  );
}
