"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { disconnectCalendar } from "@/domains/calendar/connect-actions";
import type { CalendarProviderId } from "@/platform/calendar/types";
import type { CalendarConnection } from "@/domains/calendar/schema";
import { Button } from "@/platform/ui/Button";

/** Non-destructive actions use the shared Button primitive (brand tokens,
 * no motion) per Settings' Tier 2 treatment. The destructive "Yes,
 * disconnect" confirm stays a raw red button, matching
 * RestartOnboardingButton's same deliberate exception. */
export function ConnectionRow({
  label,
  provider,
  connection,
  configured,
  connectAction,
}: {
  label: string;
  provider: CalendarProviderId;
  connection: CalendarConnection | null;
  configured: boolean;
  connectAction?: () => Promise<void>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const onDisconnect = () => {
    startTransition(async () => {
      await disconnectCalendar(provider);
      setConfirming(false);
      router.refresh();
    });
  };

  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium">{label}</p>
          {connection ? (
            <p className="text-sm text-neutral-500">
              {connection.accountEmail ?? "Connected"} · since{" "}
              {new Date(connection.connectedAt).toLocaleDateString()}
            </p>
          ) : configured ? (
            <p className="text-sm text-neutral-500">Not connected</p>
          ) : (
            <p className="text-sm text-neutral-400">Not available</p>
          )}
        </div>

        {connection ? (
          confirming ? (
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={onDisconnect}
                disabled={isPending}
                className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
              >
                {isPending ? "Disconnecting…" : "Yes, disconnect"}
              </button>
              <Button type="button" variant="secondary" onClick={() => setConfirming(false)} disabled={isPending}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button type="button" variant="secondary" className="shrink-0" onClick={() => setConfirming(true)}>
              Disconnect
            </Button>
          )
        ) : configured && connectAction ? (
          <form action={connectAction} className="shrink-0">
            <Button type="submit" variant="primary">
              Connect
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
