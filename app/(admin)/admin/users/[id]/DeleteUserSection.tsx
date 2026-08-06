"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteUserAdmin } from "@/domains/users/service";
import { TextInput } from "@/platform/ui/FormField";
import { Button } from "@/platform/ui/Button";

/** The only friction standing between a click and permanently deleting a
 * real person's account and every row of their data. Matching the
 * account's exact email (not just a "yes/confirm" click) is deliberately
 * a higher bar than the rest of this portal's other destructive actions
 * (status changes, rejections) — those are all reversible; this isn't. */
export function DeleteUserSection({
  targetUserId,
  currentUserId,
  email,
}: {
  targetUserId: string;
  currentUserId: string;
  email: string | null;
}) {
  const router = useRouter();
  const isSelf = targetUserId === currentUserId;
  const [confirmText, setConfirmText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (isSelf) {
    return <p className="text-sm text-neutral-500">You can&apos;t delete your own account from here.</p>;
  }

  const canDelete = !!email && confirmText === email;

  function onDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteUserAdmin(targetUserId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/admin/users");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-red-300 p-4 dark:border-red-900">
      <p className="text-sm font-medium text-red-700 dark:text-red-400">Delete this account</p>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Permanent. Deletes the auth account and cascades through every table that references it —
        goals, logs, plans, everything. There is no undo and no export triggered automatically; if they
        need their data, that has to happen before this.
      </p>
      {email ? (
        <p className="text-sm">
          Type <span className="font-mono font-semibold">{email}</span> to confirm.
        </p>
      ) : (
        <p className="text-sm text-neutral-500">
          This account has no email on file, so there&apos;s nothing to type-to-confirm against —
          deletion is disabled here as a result.
        </p>
      )}
      <TextInput
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder={email ?? undefined}
        disabled={!email}
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button
        type="button"
        variant="secondary"
        disabled={!canDelete || isPending}
        onClick={onDelete}
        className="border-red-400 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
      >
        {isPending ? "Deleting…" : "Permanently delete this account"}
      </Button>
    </div>
  );
}
