"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateInviteCode, revokeInviteCode } from "@/domains/trainer/service";
import { Button } from "@/platform/ui/Button";
import { Card } from "@/platform/ui/Card";
import type { InviteCode } from "@/domains/trainer/types";

function codeStatus(code: InviteCode): { label: string; tone: string } {
  if (code.usedAt) return { label: `Used by ${code.usedByName ?? "a client"}`, tone: "text-neutral-500" };
  if (code.revokedAt) return { label: "Revoked", tone: "text-neutral-400" };
  if (code.expiresAt && new Date(code.expiresAt) < new Date()) {
    return { label: "Expired", tone: "text-neutral-400" };
  }
  return { label: "Active — not yet redeemed", tone: "text-green-700 dark:text-green-400" };
}

/** Renders `initialCodes` directly rather than mirroring it into local
 * state — this list has no local-only edit state of its own, it's pure
 * server truth, so there's nothing a `codes` useState would hold that
 * the prop doesn't already have. Found via manual browser testing
 * (2026-08-06): an earlier version held its own `useState(initialCodes)`
 * that only ever seeded once on mount, so generating a code showed the
 * "New code: X" card correctly but the list below kept saying "No
 * invite codes yet" until a full page reload — router.refresh() alone
 * never reaches state that already exists independent of props. Same
 * gap, same fix, in TrainerSettingsPanel.tsx (settings/trainer). */
export function InviteCodePanel({ initialCodes }: { initialCodes: InviteCode[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<string | null>(null);

  const onGenerate = () => {
    setError(null);
    setJustCreated(null);
    startTransition(async () => {
      const result = await generateInviteCode();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setJustCreated(result.data.code);
      router.refresh();
    });
  };

  const onRevoke = (id: string) => {
    setError(null);
    startTransition(async () => {
      const result = await revokeInviteCode(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Invite codes</p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Share a code with a client so they can connect with you. They enter it in Settings → Trainer. Each
            code works once and expires in 7 days.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="shrink-0"
          disabled={isPending}
          onClick={onGenerate}
        >
          {isPending ? "Generating…" : "+ New invite code"}
        </Button>
      </div>

      {justCreated ? (
        <Card className="border-brand/40 bg-brand/5">
          <p className="text-sm">
            New code: <span className="font-mono text-base font-semibold">{justCreated}</span>
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Share this with your client — they enter it under Settings → Trainer. Expires in 7 days.
          </p>
        </Card>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {initialCodes.length === 0 ? (
        <p className="text-sm text-neutral-500">No invite codes yet.</p>
      ) : (
        <div className="space-y-1.5">
          {initialCodes.map((code) => {
            const status = codeStatus(code);
            const canRevoke = !code.usedAt && !code.revokedAt;
            return (
              <div
                key={code.id}
                className="flex items-center justify-between rounded-xl border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800"
              >
                <div>
                  <span className="font-mono">{code.code}</span>
                  <span className={`ml-2 text-xs ${status.tone}`}>{status.label}</span>
                </div>
                {canRevoke ? (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => onRevoke(code.id)}
                    className="text-xs text-neutral-500 hover:underline disabled:opacity-50"
                  >
                    Revoke
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
