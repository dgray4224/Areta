"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { disconnectCalendar } from "@/domains/calendar/connect-actions";
import type { CalendarProviderId } from "@/platform/calendar/types";
import type { CalendarConnection } from "@/domains/calendar/schema";

/** Matches the existing Settings page style (plain neutral borders, no
 * brand-fill pills) rather than the newer Card/Button primitives — Settings
 * is explicitly still Phase 2 in the terracotta rebrand plan, so a new
 * Settings page should stay visually consistent with its neighbors
 * (ProfileForm, RestartOnboardingButton), not introduce a one-off look. */
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
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={isPending}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="shrink-0 rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              Disconnect
            </button>
          )
        ) : configured && connectAction ? (
          <form action={connectAction} className="shrink-0">
            <button
              type="submit"
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
            >
              Connect
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
